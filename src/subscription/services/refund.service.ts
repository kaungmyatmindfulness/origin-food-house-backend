import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  Prisma,
  RefundRequest,
  RefundStatus,
  SubscriptionTier,
  TransactionType,
} from "@prisma/client";

import { AuditLogService } from "../../audit-log/audit-log.service";
import { getErrorDetails } from "../../common/utils/error.util";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);
  private readonly REFUND_WINDOW_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async requestRefund(
    userId: string,
    subscriptionId: string,
    transactionId: string,
    reason: string,
  ): Promise<RefundRequest> {
    const method = this.requestRefund.name;
    this.logger.log(
      `[${method}] User ${userId} requesting refund for transaction ${transactionId}`,
    );

    await this.validateRefundEligibility(subscriptionId, transactionId);

    try {
      const transaction =
        await this.prisma.paymentTransaction.findUniqueOrThrow({
          where: { id: transactionId },
          include: { subscription: true },
        });

      const refundRequest = await this.prisma.refundRequest.create({
        data: {
          subscriptionId,
          transactionId,
          requestedAmount: transaction.amount,
          currency: transaction.currency,
          reason,
          requestedBy: userId,
          status: RefundStatus.REQUESTED,
        },
      });

      await this.auditLogService.createLog({
        storeId: transaction.subscription?.storeId,
        userId,
        action: "REFUND_REQUESTED",
        entityType: "RefundRequest",
        entityId: refundRequest.id,
        details: {
          transactionId,
          amount: transaction.amount.toString(),
          currency: transaction.currency,
          reason,
        },
      });

      this.logger.log(
        `[${method}] Refund request created: ${refundRequest.id}`,
      );

      return refundRequest;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Transaction not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to create refund request`, stack);
      throw new InternalServerErrorException("Failed to request refund");
    }
  }

  async validateRefundEligibility(
    subscriptionId: string,
    transactionId: string,
  ): Promise<void> {
    const method = this.validateRefundEligibility.name;
    this.logger.log(
      `[${method}] Validating refund eligibility for transaction ${transactionId}`,
    );

    try {
      const transaction =
        await this.prisma.paymentTransaction.findUniqueOrThrow({
          where: { id: transactionId, deletedAt: null },
          include: { subscription: true },
        });

      if (transaction.subscriptionId !== subscriptionId) {
        throw new BadRequestException(
          "Transaction does not belong to this subscription",
        );
      }

      if (transaction.transactionType !== TransactionType.PAYMENT) {
        throw new BadRequestException(
          "Only payment transactions can be refunded",
        );
      }

      const existingRefund = await this.prisma.refundRequest.findFirst({
        where: {
          transactionId,
          status: {
            in: [
              RefundStatus.REQUESTED,
              RefundStatus.APPROVED,
              RefundStatus.PROCESSED,
            ],
          },
        },
      });

      if (existingRefund) {
        throw new BadRequestException(
          "A refund request already exists for this transaction",
        );
      }

      const daysSincePayment = Math.floor(
        (Date.now() - transaction.processedAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysSincePayment > this.REFUND_WINDOW_DAYS) {
        throw new BadRequestException(
          `Refund window expired. Refunds must be requested within ${this.REFUND_WINDOW_DAYS} days of payment.`,
        );
      }

      this.logger.log(
        `[${method}] Transaction eligible for refund (${daysSincePayment} days old)`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Transaction not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to validate refund eligibility`,
        stack,
      );
      throw new InternalServerErrorException(
        "Failed to validate refund eligibility",
      );
    }
  }

  async approveRefund(
    adminId: string,
    refundRequestId: string,
    approvalNotes?: string,
  ): Promise<RefundRequest> {
    const method = this.approveRefund.name;
    this.logger.log(
      `[${method}] Admin ${adminId} approving refund request ${refundRequestId}`,
    );

    try {
      const refundRequest = await this.prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          status: RefundStatus.APPROVED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          approvalNotes,
        },
        include: { subscription: true },
      });

      await this.auditLogService.createLog({
        storeId: refundRequest.subscription.storeId,
        userId: adminId,
        action: "REFUND_APPROVED",
        entityType: "RefundRequest",
        entityId: refundRequestId,
        details: {
          requestedBy: refundRequest.requestedBy,
          amount: refundRequest.requestedAmount.toString(),
          approvalNotes,
        },
      });

      this.logger.log(
        `[${method}] Refund request approved: ${refundRequestId}`,
      );

      return refundRequest;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Refund request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to approve refund request`, stack);
      throw new InternalServerErrorException("Failed to approve refund");
    }
  }

  async rejectRefund(
    adminId: string,
    refundRequestId: string,
    rejectionReason: string,
  ): Promise<RefundRequest> {
    const method = this.rejectRefund.name;
    this.logger.log(
      `[${method}] Admin ${adminId} rejecting refund request ${refundRequestId}`,
    );

    try {
      const refundRequest = await this.prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: {
          status: RefundStatus.REJECTED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason,
        },
        include: { subscription: true },
      });

      await this.auditLogService.createLog({
        storeId: refundRequest.subscription.storeId,
        userId: adminId,
        action: "REFUND_REJECTED",
        entityType: "RefundRequest",
        entityId: refundRequestId,
        details: {
          requestedBy: refundRequest.requestedBy,
          rejectionReason,
        },
      });

      this.logger.log(
        `[${method}] Refund request rejected: ${refundRequestId}`,
      );

      return refundRequest;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Refund request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to reject refund request`, stack);
      throw new InternalServerErrorException("Failed to reject refund");
    }
  }

  async processRefund(
    financeId: string,
    refundRequestId: string,
    refundMethod: string,
    refundProofUrl?: string,
  ): Promise<void> {
    const method = this.processRefund.name;
    this.logger.log(
      `[${method}] Processing refund ${refundRequestId} via ${refundMethod}`,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const refund = await tx.refundRequest.findUniqueOrThrow({
          where: { id: refundRequestId },
          include: { transaction: true, subscription: true },
        });

        if (refund.status !== RefundStatus.APPROVED) {
          throw new BadRequestException(
            "Refund must be approved before processing",
          );
        }

        await tx.refundRequest.update({
          where: { id: refundRequestId },
          data: {
            status: RefundStatus.PROCESSED,
            processedBy: financeId,
            processedAt: new Date(),
            refundMethod,
            refundProofUrl,
          },
        });

        await tx.paymentTransaction.create({
          data: {
            subscriptionId: refund.subscriptionId,
            transactionType: TransactionType.REFUND,
            amount: refund.requestedAmount.neg(),
            currency: refund.currency,
            tier: SubscriptionTier.FREE,
            billingCycle: refund.transaction.billingCycle,
            periodStart: new Date(),
            periodEnd: new Date(),
            paymentMethod: refund.transaction.paymentMethod,
            paymentProofUrl: refundProofUrl,
            externalReference: refundRequestId,
            processedBy: financeId,
            notes: `Refund processed via ${refundMethod}`,
          },
        });

        await tx.subscription.update({
          where: { id: refund.subscriptionId },
          data: {
            tier: SubscriptionTier.FREE,
            status: "ACTIVE",
            currentPeriodStart: null,
            currentPeriodEnd: null,
          },
        });

        await tx.auditLog.create({
          data: {
            storeId: refund.subscription.storeId,
            userId: financeId,
            action: "REFUND_PROCESSED",
            entityType: "RefundRequest",
            entityId: refundRequestId,
            details: {
              amount: refund.requestedAmount.toString(),
              refundMethod,
              downgradedToFree: true,
            },
          },
        });
      });

      this.logger.log(
        `[${method}] Refund processed successfully: ${refundRequestId}`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Refund request not found");
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to process refund`, stack);
      throw new InternalServerErrorException("Failed to process refund");
    }
  }

  async createRefundRequest(
    userId: string,
    subscriptionId: string,
    reason: string,
  ): Promise<RefundRequest> {
    const method = this.createRefundRequest.name;
    this.logger.log(
      `[${method}] User ${userId} creating refund request for subscription ${subscriptionId}`,
    );

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { storeId: true },
      });

      if (!subscription) {
        throw new NotFoundException(
          `No subscription found with ID ${subscriptionId}`,
        );
      }

      const latestTransaction = await this.prisma.paymentTransaction.findFirst({
        where: {
          subscriptionId,
          transactionType: TransactionType.PAYMENT,
          deletedAt: null,
        },
        orderBy: { processedAt: "desc" },
      });

      if (!latestTransaction) {
        throw new BadRequestException("No payment found for this subscription");
      }

      await this.validateRefundEligibility(
        subscriptionId,
        latestTransaction.id,
      );

      const refundRequest = await this.requestRefund(
        userId,
        subscriptionId,
        latestTransaction.id,
        reason,
      );

      this.logger.log(
        `[${method}] Refund request created: ${refundRequest.id}`,
      );

      return refundRequest;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Failed to create refund request`, stack);
      throw new InternalServerErrorException("Failed to create refund request");
    }
  }

  async getStoreRefundRequests(storeId: string): Promise<RefundRequest[]> {
    const method = this.getStoreRefundRequests.name;
    this.logger.log(
      `[${method}] Getting refund requests for store: ${storeId}`,
    );

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { storeId },
        select: { id: true },
      });

      if (!subscription) {
        return [];
      }

      return await this.prisma.refundRequest.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to get store refund requests`,
        stack,
      );
      throw new InternalServerErrorException("Failed to get refund requests");
    }
  }
}
