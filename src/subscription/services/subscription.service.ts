import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  Prisma,
  Subscription,
  PaymentRequest,
  Role,
  SubscriptionTier,
  SubscriptionStatus,
  PaymentStatus,
} from "@prisma/client";

import { AuditLogService } from "../../audit-log/audit-log.service";
import { AuthService } from "../../auth/auth.service";
import { getErrorDetails } from "../../common/utils/error.util";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getTierForStore(storeId: string): Promise<SubscriptionTier> {
    const method = this.getTierForStore.name;
    this.logger.log(`[${method}] Getting tier for store: ${storeId}`);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
        select: { tier: true, status: true },
      });

      if (!subscription) {
        this.logger.warn(
          `[${method}] No subscription found for store ${storeId}, defaulting to FREE`,
        );
        return SubscriptionTier.FREE;
      }

      if (subscription.status === SubscriptionStatus.SUSPENDED) {
        this.logger.warn(
          `[${method}] Subscription suspended for store ${storeId}, returning FREE`,
        );
        return SubscriptionTier.FREE;
      }

      return subscription.tier;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get tier for store ${storeId}`,
        stack,
      );
      return SubscriptionTier.FREE;
    }
  }

  async getActiveSubscription(storeId: string): Promise<Subscription> {
    const method = this.getActiveSubscription.name;
    this.logger.log(`[${method}] Getting subscription for store: ${storeId}`);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
      });

      if (!subscription) {
        throw new NotFoundException(
          `No subscription found for store ${storeId}`,
        );
      }

      return subscription;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `No subscription found for store ${storeId}`,
        );
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get subscription for store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Failed to retrieve subscription");
    }
  }

  async checkSubscriptionStatus(storeId: string): Promise<{
    isActive: boolean;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
  }> {
    const method = this.checkSubscriptionStatus.name;
    this.logger.log(
      `[${method}] Checking subscription status for store: ${storeId}`,
    );

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
        select: { status: true, tier: true, currentPeriodEnd: true },
      });

      if (!subscription) {
        return {
          isActive: false,
          tier: SubscriptionTier.FREE,
          status: SubscriptionStatus.EXPIRED,
        };
      }

      const isActive =
        subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIAL;

      if (
        isActive &&
        subscription.currentPeriodEnd &&
        new Date() > subscription.currentPeriodEnd
      ) {
        return {
          isActive: false,
          tier: subscription.tier,
          status: SubscriptionStatus.EXPIRED,
        };
      }

      return {
        isActive,
        tier: subscription.tier,
        status: subscription.status,
      };
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to check subscription status for store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to check subscription status",
      );
    }
  }

  async activateSubscription(
    storeId: string,
    tier: SubscriptionTier,
    durationDays: number,
  ): Promise<Subscription> {
    const method = this.activateSubscription.name;
    this.logger.log(
      `[${method}] Activating ${tier} subscription for store: ${storeId}, duration: ${durationDays} days`,
    );

    const startDate = new Date();
    const endDate = this.calculatePeriodEnd(startDate, durationDays);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.update({
          where: { storeId },
          data: {
            tier,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            trialStartedAt: null,
            trialEndsAt: null,
          },
        });

        await tx.auditLog.create({
          data: {
            storeId,
            action: "SUBSCRIPTION_ACTIVATED",
            entityType: "Subscription",
            entityId: subscription.id,
            details: {
              tier,
              periodStart: startDate.toISOString(),
              periodEnd: endDate.toISOString(),
            },
          },
        });

        this.logger.log(
          `[${method}] Subscription activated for store ${storeId}: ${tier}`,
        );
        return subscription;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `No subscription found for store ${storeId}`,
        );
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to activate subscription for store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Failed to activate subscription");
    }
  }

  async downgradeToFreeTier(
    storeId: string,
    reason: string,
  ): Promise<Subscription> {
    const method = this.downgradeToFreeTier.name;
    this.logger.log(
      `[${method}] Downgrading store ${storeId} to FREE tier. Reason: ${reason}`,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.update({
          where: { storeId },
          data: {
            tier: SubscriptionTier.FREE,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            trialStartedAt: null,
            trialEndsAt: null,
          },
        });

        await tx.userTrialUsage.updateMany({
          where: { storeId },
          data: { isActive: false },
        });

        await tx.auditLog.create({
          data: {
            storeId,
            action: "TIER_AUTO_DOWNGRADED",
            entityType: "Subscription",
            entityId: subscription.id,
            details: {
              previousTier: subscription.tier,
              newTier: SubscriptionTier.FREE,
              reason,
            },
          },
        });

        this.logger.log(
          `[${method}] Store ${storeId} downgraded to FREE tier successfully`,
        );
        return subscription;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `No subscription found for store ${storeId}`,
        );
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to downgrade store ${storeId} to FREE tier`,
        stack,
      );
      throw new InternalServerErrorException("Failed to downgrade tier");
    }
  }

  private calculatePeriodEnd(startDate: Date, durationDays: number): Date {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    return endDate;
  }

  private calculateTierPrice(tier: SubscriptionTier): Prisma.Decimal {
    const prices: Record<SubscriptionTier, number> = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STANDARD]: 240,
      [SubscriptionTier.PREMIUM]: 1200,
    };

    return new Prisma.Decimal(prices[tier].toString());
  }

  private generateReferenceNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `OFH-${year}-${random}`;
  }

  private async validateOwnership(
    userId: string,
    storeId: string,
  ): Promise<void> {
    await this.authService.checkStorePermission(userId, storeId, [Role.OWNER]);
  }

  private isUpgrade(
    currentTier: SubscriptionTier,
    requestedTier: SubscriptionTier,
  ): boolean {
    const tierHierarchy: Record<SubscriptionTier, number> = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STANDARD]: 1,
      [SubscriptionTier.PREMIUM]: 2,
    };

    return tierHierarchy[requestedTier] > tierHierarchy[currentTier];
  }

  async checkStorePermission(
    userId: string,
    storeId: string,
    allowedRoles: Role[] = [Role.OWNER, Role.ADMIN],
  ): Promise<void> {
    await this.authService.checkStorePermission(userId, storeId, allowedRoles);
  }

  async createPaymentRequest(
    userId: string,
    storeId: string,
    tier: SubscriptionTier,
  ): Promise<PaymentRequest> {
    const method = this.createPaymentRequest.name;
    this.logger.log(
      `[${method}] Creating payment request for store ${storeId}, tier: ${tier}`,
    );

    if (tier === SubscriptionTier.FREE) {
      throw new BadRequestException(
        "Cannot create payment request for FREE tier",
      );
    }

    const amount = this.calculateTierPrice(tier);
    const referenceNumber = this.generateReferenceNumber();

    try {
      const paymentRequest = await this.prisma.paymentRequest.create({
        data: {
          subscriptionId: storeId,
          requestedTier: tier,
          amount,
          requestedBy: userId,
          requestedAt: new Date(),
        },
      });

      await this.auditLogService.createLog({
        storeId,
        userId,
        action: "PAYMENT_REQUEST_CREATED",
        entityType: "PaymentRequest",
        entityId: paymentRequest.id,
        details: {
          tier,
          amount: amount.toString(),
          referenceNumber,
        },
      });

      this.logger.log(
        `[${method}] Payment request created: ${paymentRequest.id}`,
      );

      return paymentRequest;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to create payment request`, stack);
      throw new InternalServerErrorException(
        "Failed to create payment request",
      );
    }
  }

  async getPaymentRequest(
    userId: string,
    paymentRequestId: string,
  ): Promise<PaymentRequest> {
    const method = this.getPaymentRequest.name;
    this.logger.log(`[${method}] Getting payment request: ${paymentRequestId}`);

    try {
      const paymentRequest = await this.prisma.paymentRequest.findUniqueOrThrow(
        {
          where: { id: paymentRequestId },
        },
      );

      const subscription = await this.prisma.subscription.findUnique({
        where: { id: paymentRequest.subscriptionId },
        select: { storeId: true },
      });

      if (!subscription) {
        throw new NotFoundException("Subscription not found");
      }

      await this.checkStorePermission(userId, subscription.storeId, [
        Role.OWNER,
        Role.ADMIN,
      ]);

      return paymentRequest;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Payment request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to get payment request`, stack);
      throw new InternalServerErrorException("Failed to get payment request");
    }
  }

  async getStorePaymentRequests(storeId: string): Promise<PaymentRequest[]> {
    const method = this.getStorePaymentRequests.name;
    this.logger.log(
      `[${method}] Getting payment requests for store: ${storeId}`,
    );

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
        select: { id: true },
      });

      if (!subscription) {
        return [];
      }

      return await this.prisma.paymentRequest.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { requestedAt: "desc" },
      });
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get store payment requests`,
        stack,
      );
      throw new InternalServerErrorException("Failed to get payment requests");
    }
  }

  async checkPlatformAdmin(adminId: string): Promise<void> {
    const method = this.checkPlatformAdmin.name;
    this.logger.log(`[${method}] Checking platform admin: ${adminId}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { auth0Id: adminId },
        select: { id: true },
      });

      if (!user) {
        throw new ForbiddenException("User not found");
      }

      const platformAdminRole = await this.prisma.userStore.findFirst({
        where: {
          userId: user.id,
          role: Role.PLATFORM_ADMIN,
        },
      });

      if (!platformAdminRole) {
        throw new ForbiddenException(
          "Only PLATFORM_ADMIN users can perform this action",
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to check platform admin`, stack);
      throw new InternalServerErrorException("Failed to verify permissions");
    }
  }

  async getPaymentQueue(options: {
    status?: string;
    page: number;
    limit: number;
  }): Promise<{
    requests: PaymentRequest[];
    total: number;
    page: number;
    limit: number;
  }> {
    const method = this.getPaymentQueue.name;
    const { status, page, limit } = options;
    const skip = (page - 1) * limit;

    this.logger.log(
      `[${method}] Getting payment queue (status: ${status}, page: ${page}, limit: ${limit})`,
    );

    try {
      const where: Prisma.PaymentRequestWhereInput = {};

      if (status) {
        where.status = status as PaymentStatus;
      }

      const [requests, total] = await Promise.all([
        this.prisma.paymentRequest.findMany({
          where,
          skip,
          take: limit,
          orderBy: { requestedAt: "asc" },
        }),
        this.prisma.paymentRequest.count({ where }),
      ]);

      return {
        requests,
        total,
        page,
        limit,
      };
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to get payment queue`, stack);
      throw new InternalServerErrorException("Failed to get payment queue");
    }
  }

  async getPaymentRequestDetail(
    paymentRequestId: string,
  ): Promise<PaymentRequest> {
    const method = this.getPaymentRequestDetail.name;
    this.logger.log(
      `[${method}] Getting payment request detail: ${paymentRequestId}`,
    );

    try {
      return await this.prisma.paymentRequest.findUniqueOrThrow({
        where: { id: paymentRequestId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Payment request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get payment request detail`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to get payment request detail",
      );
    }
  }

  async verifyPaymentRequest(
    adminId: string,
    paymentRequestId: string,
    notes?: string,
  ): Promise<void> {
    const method = this.verifyPaymentRequest.name;
    this.logger.log(
      `[${method}] Admin ${adminId} verifying payment request ${paymentRequestId}`,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const paymentRequest = await tx.paymentRequest.findUniqueOrThrow({
          where: { id: paymentRequestId },
        });

        await tx.paymentRequest.update({
          where: { id: paymentRequestId },
          data: {
            status: "VERIFIED",
            verifiedBy: adminId,
            verifiedAt: new Date(),
            notes,
          },
        });

        const subscription = await tx.subscription.findUnique({
          where: { id: paymentRequest.subscriptionId },
        });

        if (!subscription) {
          throw new NotFoundException("Subscription not found");
        }

        const startDate = new Date();
        const endDate = this.calculatePeriodEnd(
          startDate,
          paymentRequest.requestedDuration,
        );

        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            tier: paymentRequest.requestedTier,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            trialStartedAt: null,
            trialEndsAt: null,
          },
        });

        await tx.paymentRequest.update({
          where: { id: paymentRequestId },
          data: {
            status: "ACTIVATED",
            activatedBy: adminId,
            activatedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            storeId: subscription.storeId,
            userId: adminId,
            action: "PAYMENT_VERIFIED",
            entityType: "PaymentRequest",
            entityId: paymentRequestId,
            details: {
              tier: paymentRequest.requestedTier,
              amount: paymentRequest.amount.toString(),
              notes,
            },
          },
        });
      });

      this.logger.log(
        `[${method}] Payment verified and subscription activated: ${paymentRequestId}`,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Payment request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to verify payment request`, stack);
      throw new InternalServerErrorException("Failed to verify payment");
    }
  }

  async rejectPaymentRequest(
    adminId: string,
    paymentRequestId: string,
    reason: string,
  ): Promise<void> {
    const method = this.rejectPaymentRequest.name;
    this.logger.log(
      `[${method}] Admin ${adminId} rejecting payment request ${paymentRequestId}`,
    );

    try {
      const paymentRequest = await this.prisma.paymentRequest.update({
        where: { id: paymentRequestId },
        data: {
          status: "REJECTED",
          verifiedBy: adminId,
          verifiedAt: new Date(),
          rejectionReason: reason,
        },
      });

      const subscription = await this.prisma.subscription.findUnique({
        where: { id: paymentRequest.subscriptionId },
        select: { storeId: true },
      });

      if (subscription) {
        await this.auditLogService.createLog({
          storeId: subscription.storeId,
          userId: adminId,
          action: "REFUND_REJECTED",
          entityType: "PaymentRequest",
          entityId: paymentRequestId,
          details: {
            reason,
            requestedTier: paymentRequest.requestedTier,
          },
        });
      }

      this.logger.log(
        `[${method}] Payment request rejected: ${paymentRequestId}`,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Payment request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to reject payment request`, stack);
      throw new InternalServerErrorException("Failed to reject payment");
    }
  }

  async getAdminMetrics(): Promise<{
    pendingCount: number;
    verifiedCount: number;
    rejectedCount: number;
    avgProcessingTime: number;
  }> {
    const method = this.getAdminMetrics.name;
    this.logger.log(`[${method}] Getting admin dashboard metrics`);

    try {
      const [pendingCount, verifiedCount, rejectedCount, allRequests] =
        await Promise.all([
          this.prisma.paymentRequest.count({
            where: { status: "PENDING_VERIFICATION" },
          }),
          this.prisma.paymentRequest.count({
            where: { status: "VERIFIED" },
          }),
          this.prisma.paymentRequest.count({
            where: { status: "REJECTED" },
          }),
          this.prisma.paymentRequest.findMany({
            where: {
              verifiedAt: { not: null },
            },
            select: {
              requestedAt: true,
              verifiedAt: true,
            },
          }),
        ]);

      let avgProcessingTime = 0;
      if (allRequests.length > 0) {
        const totalTime = allRequests.reduce((sum, req) => {
          if (req.verifiedAt) {
            return (
              sum +
              (req.verifiedAt.getTime() - req.requestedAt.getTime()) /
                (1000 * 60 * 60)
            );
          }
          return sum;
        }, 0);
        avgProcessingTime = totalTime / allRequests.length;
      }

      return {
        pendingCount,
        verifiedCount,
        rejectedCount,
        avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      };
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to get admin metrics`, stack);
      throw new InternalServerErrorException("Failed to get admin metrics");
    }
  }

  async getStoreSubscription(storeId: string): Promise<Subscription> {
    const method = this.getStoreSubscription.name;
    this.logger.log(`[${method}] Getting subscription for store: ${storeId}`);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
      });

      if (!subscription) {
        throw new NotFoundException(
          `No subscription found for store ${storeId}`,
        );
      }

      return subscription;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(
          `No subscription found for store ${storeId}`,
        );
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to get store subscription`, stack);
      throw new InternalServerErrorException(
        "Failed to get store subscription",
      );
    }
  }
}
