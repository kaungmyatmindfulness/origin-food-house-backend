import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  Prisma,
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
} from "@prisma/client";

import { AuditLogService } from "../../audit-log/audit-log.service";
import { getErrorDetails } from "../../common/utils/error.util";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TrialService {
  private readonly logger = new Logger(TrialService.name);
  private readonly TRIAL_DURATION_DAYS = 30;
  private readonly MAX_TRIALS_PER_USER = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async checkTrialEligibility(userId: string): Promise<boolean> {
    const method = this.checkTrialEligibility.name;
    this.logger.log(
      `[${method}] Checking trial eligibility for user: ${userId}`,
    );

    try {
      const activeTrialCount = await this.prisma.userTrialUsage.count({
        where: { userId, isActive: true },
      });

      const canStartTrial = activeTrialCount < this.MAX_TRIALS_PER_USER;

      this.logger.log(
        `[${method}] User ${userId} has ${activeTrialCount}/${this.MAX_TRIALS_PER_USER} active trials. Eligible: ${canStartTrial}`,
      );

      return canStartTrial;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to check trial eligibility for user ${userId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to check trial eligibility",
      );
    }
  }

  async autoGrantTrialOnStoreCreation(
    userId: string,
    storeId: string,
  ): Promise<Subscription | null> {
    const method = this.autoGrantTrialOnStoreCreation.name;
    this.logger.log(
      `[${method}] Auto-granting trial for new store: ${storeId}, user: ${userId}`,
    );

    const canTrial = await this.checkTrialEligibility(userId);

    if (!canTrial) {
      this.logger.warn(
        `[${method}] User ${userId} has reached trial limit (${this.MAX_TRIALS_PER_USER} stores)`,
      );
      return null;
    }

    const trialStart = new Date();
    const trialEnd = this.calculateTrialEnd(trialStart);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.create({
          data: {
            storeId,
            tier: SubscriptionTier.STANDARD,
            status: SubscriptionStatus.TRIAL,
            isTrialUsed: true,
            trialStartedAt: trialStart,
            trialEndsAt: trialEnd,
            currentPeriodStart: trialStart,
            currentPeriodEnd: trialEnd,
          },
        });

        await tx.userTrialUsage.create({
          data: {
            userId,
            storeId,
            trialTier: SubscriptionTier.STANDARD,
            trialStartedAt: trialStart,
            trialEndsAt: trialEnd,
            isActive: true,
          },
        });

        await tx.auditLog.create({
          data: {
            storeId,
            userId,
            action: "TRIAL_STARTED",
            entityType: "Subscription",
            entityId: subscription.id,
            details: {
              tier: SubscriptionTier.STANDARD,
              durationDays: this.TRIAL_DURATION_DAYS,
              trialEndsAt: trialEnd.toISOString(),
            },
          },
        });

        this.logger.log(
          `[${method}] Trial granted successfully for store ${storeId} (user ${userId})`,
        );

        return subscription;
      });
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to auto-grant trial for store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Failed to grant trial");
    }
  }

  async getTrialDaysRemaining(storeId: string): Promise<number> {
    const method = this.getTrialDaysRemaining.name;
    this.logger.log(
      `[${method}] Getting trial days remaining for store: ${storeId}`,
    );

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
        select: { trialEndsAt: true, status: true },
      });

      if (
        !subscription ||
        subscription.status !== SubscriptionStatus.TRIAL ||
        !subscription.trialEndsAt
      ) {
        return 0;
      }

      const now = new Date();
      const daysRemaining = Math.ceil(
        (subscription.trialEndsAt.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return Math.max(0, daysRemaining);
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get trial days remaining for store ${storeId}`,
        stack,
      );
      return 0;
    }
  }

  async expireTrial(storeId: string): Promise<Subscription> {
    const method = this.expireTrial.name;
    this.logger.log(
      `[${method}] Expiring trial and downgrading to FREE for store: ${storeId}`,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.update({
          where: { storeId },
          data: {
            tier: SubscriptionTier.FREE,
            status: SubscriptionStatus.ACTIVE,
            trialStartedAt: null,
            trialEndsAt: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
          },
        });

        await tx.userTrialUsage.updateMany({
          where: { storeId },
          data: { isActive: false },
        });

        await tx.auditLog.create({
          data: {
            storeId,
            action: "TRIAL_EXPIRED",
            entityType: "Subscription",
            entityId: subscription.id,
            details: {
              previousTier: SubscriptionTier.STANDARD,
              newTier: SubscriptionTier.FREE,
              reason: "Trial period expired",
            },
          },
        });

        this.logger.log(
          `[${method}] Trial expired for store ${storeId}, downgraded to FREE`,
        );

        return subscription;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new BadRequestException(
          `No subscription found for store ${storeId}`,
        );
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to expire trial for store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Failed to expire trial");
    }
  }

  async autoDowngradeExpiredTrials(): Promise<number> {
    const method = this.autoDowngradeExpiredTrials.name;
    this.logger.log(`[${method}] Starting trial expiration check`);

    try {
      const expiredTrials = await this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.TRIAL,
          trialEndsAt: { lt: new Date() },
        },
        select: { storeId: true, id: true },
        take: 100,
      });

      this.logger.log(
        `[${method}] Found ${expiredTrials.length} expired trials to process`,
      );

      let downgradeCount = 0;

      for (const subscription of expiredTrials) {
        try {
          await this.expireTrial(subscription.storeId);
          downgradeCount++;
        } catch (error) {
          const { stack } = getErrorDetails(error);
          this.logger.error(
            `[${method}] Failed to downgrade trial for store ${subscription.storeId}`,
            stack,
          );
        }
      }

      this.logger.log(
        `[${method}] Successfully downgraded ${downgradeCount}/${expiredTrials.length} expired trials`,
      );

      return downgradeCount;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to auto-downgrade expired trials`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to downgrade expired trials",
      );
    }
  }

  async sendTrialWarnings(): Promise<number> {
    const method = this.sendTrialWarnings.name;
    this.logger.log(`[${method}] Checking for trials expiring soon`);

    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const expiringTrials = await this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.TRIAL,
          trialEndsAt: {
            gte: new Date(),
            lte: sevenDaysFromNow,
          },
        },
        select: {
          storeId: true,
          id: true,
          trialEndsAt: true,
        },
        take: 100,
      });

      this.logger.log(
        `[${method}] Found ${expiringTrials.length} trials expiring within 7 days`,
      );

      let warningCount = 0;

      for (const subscription of expiringTrials) {
        try {
          await this.auditLogService.createLog({
            storeId: subscription.storeId,
            action: "TRIAL_WARNING_SENT",
            entityType: "Subscription",
            entityId: subscription.id,
            details: {
              trialEndsAt: subscription.trialEndsAt?.toISOString(),
              daysRemaining: Math.ceil(
                (subscription.trialEndsAt!.getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              ),
            },
          });

          warningCount++;
        } catch (error) {
          const { stack } = getErrorDetails(error);
          this.logger.error(
            `[${method}] Failed to log trial warning for store ${subscription.storeId}`,
            stack,
          );
        }
      }

      this.logger.log(
        `[${method}] Logged ${warningCount}/${expiringTrials.length} trial warnings`,
      );

      return warningCount;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to send trial warnings`, stack);
      throw new InternalServerErrorException("Failed to send trial warnings");
    }
  }

  private calculateTrialEnd(startDate: Date): Date {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + this.TRIAL_DURATION_DAYS);
    return endDate;
  }

  async getTrialInfo(storeId: string): Promise<{
    isTrialActive: boolean;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    daysRemaining: number;
    canStartTrial: boolean;
  }> {
    const method = this.getTrialInfo.name;
    this.logger.log(`[${method}] Getting trial info for store: ${storeId}`);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
        select: {
          status: true,
          trialStartedAt: true,
          trialEndsAt: true,
          isTrialUsed: true,
        },
      });

      if (!subscription) {
        return {
          isTrialActive: false,
          trialStartedAt: null,
          trialEndsAt: null,
          daysRemaining: 0,
          canStartTrial: true,
        };
      }

      const isTrialActive =
        subscription.status === SubscriptionStatus.TRIAL &&
        subscription.trialEndsAt !== null &&
        new Date() < subscription.trialEndsAt;

      const daysRemaining = isTrialActive
        ? await this.getTrialDaysRemaining(storeId)
        : 0;

      return {
        isTrialActive,
        trialStartedAt: subscription.trialStartedAt,
        trialEndsAt: subscription.trialEndsAt,
        daysRemaining,
        canStartTrial: !subscription.isTrialUsed,
      };
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get trial info for store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Failed to get trial info");
    }
  }
}
