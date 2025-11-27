import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import {
  Prisma,
  RefundRequest,
  RefundStatus,
  SubscriptionTier,
  TransactionType,
} from "src/generated/prisma/client";

import { AuditLogService } from "../../audit-log/audit-log.service";
import { getErrorDetails } from "../../common/utils/error.util";
import { PrismaService } from "../../prisma/prisma.service";

/** HTTP exceptions that should be re-thrown without wrapping */
type HttpException =
  | BadRequestException
  | NotFoundException
  | InternalServerErrorException;

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);
  private readonly REFUND_WINDOW_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Checks if error is an HTTP exception that should be re-thrown
   */
  private isHttpException(error: unknown): error is HttpException {
    return (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof InternalServerErrorException
    );
  }

  /**
   * Checks if error is a Prisma "record not found" error (P2025)
   */
  private isPrismaNotFoundError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    );
  }

  /**
   * Handles errors consistently across all methods
   * Re-throws HTTP exceptions, converts Prisma P2025 to NotFoundException,
   * and wraps other errors in InternalServerErrorException
   */
  private handleError(
    error: unknown,
    methodName: string,
    notFoundMessage: string,
    fallbackMessage: string,
  ): never {
    if (this.isHttpException(error)) {
      throw error;
    }

    if (this.isPrismaNotFoundError(error)) {
      throw new NotFoundException(notFoundMessage);
    }

    const { stack } = getErrorDetails(error);
    this.logger.error(`[${methodName}] ${fallbackMessage}`, stack);
    throw new InternalServerErrorException(fallbackMessage);
  }

  /**
   * Creates a refund request for a specific transaction
   * @param userId - User requesting the refund
   * @param subscriptionId - Subscription ID
   * @param transactionId - Transaction to refund
   * @param reason - Reason for refund request
   * @param skipValidation - Skip eligibility validation (used when called from createRefundRequest)
   * @returns Created refund request
   */
  async requestRefund(
    userId: string,
    subscriptionId: string,
    transactionId: string,
    reason: string,
    skipValidation = false,
  ): Promise<RefundRequest> {
    const method = this.requestRefund.name;
    this.logger.log(
      `[${method}] User ${userId} requesting refund for transaction ${transactionId}`,
    );

    if (!skipValidation) {
      await this.validateRefundEligibility(subscriptionId, transactionId);
    }

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
      this.handleError(
        error,
        method,
        "Transaction not found",
        "Failed to request refund",
      );
    }
  }

  /**
   * Validates whether a transaction is eligible for refund
   * @param subscriptionId - Subscription ID to validate against
   * @param transactionId - Transaction ID to check eligibility
   * @throws BadRequestException if transaction is not eligible
   * @throws NotFoundException if transaction not found
   */
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

      const { processedAt } = transaction;
      if (!processedAt) {
        throw new BadRequestException("Transaction has not been processed yet");
      }

      const daysSincePayment = Math.floor(
        (Date.now() - processedAt.getTime()) / (1000 * 60 * 60 * 24),
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
      this.handleError(
        error,
        method,
        "Transaction not found",
        "Failed to validate refund eligibility",
      );
    }
  }

  /**
   * Approves a refund request
   * @param adminId - Admin user ID approving the request
   * @param refundRequestId - Refund request ID
   * @param approvalNotes - Optional notes for approval
   * @returns Updated refund request
   */
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
      this.handleError(
        error,
        method,
        "Refund request not found",
        "Failed to approve refund",
      );
    }
  }

  /**
   * Rejects a refund request
   * @param adminId - Admin user ID rejecting the request
   * @param refundRequestId - Refund request ID
   * @param rejectionReason - Reason for rejection
   * @returns Updated refund request
   */
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
      this.handleError(
        error,
        method,
        "Refund request not found",
        "Failed to reject refund",
      );
    }
  }

  /**
   * Processes an approved refund request
   * Creates a refund transaction and downgrades subscription to FREE tier
   * @param financeId - Finance user ID processing the refund
   * @param refundRequestId - Refund request ID
   * @param refundMethod - Method used for refund (e.g., "bank_transfer")
   * @param refundProofPath - Optional path to refund proof document
   */
  async processRefund(
    financeId: string,
    refundRequestId: string,
    refundMethod: string,
    refundProofPath?: string,
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
            refundProofPath,
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
            paymentProofPath: refundProofPath,
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
      this.handleError(
        error,
        method,
        "Refund request not found",
        "Failed to process refund",
      );
    }
  }

  /**
   * Creates a refund request for the latest payment transaction of a subscription
   * @param userId - User requesting the refund
   * @param subscriptionId - Subscription ID
   * @param reason - Reason for refund request
   * @returns Created refund request
   */
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

      // Validate eligibility first
      await this.validateRefundEligibility(
        subscriptionId,
        latestTransaction.id,
      );

      // Skip validation in requestRefund since we already validated above
      const refundRequest = await this.requestRefund(
        userId,
        subscriptionId,
        latestTransaction.id,
        reason,
        true, // skipValidation
      );

      this.logger.log(
        `[${method}] Refund request created: ${refundRequest.id}`,
      );

      return refundRequest;
    } catch (error) {
      this.handleError(
        error,
        method,
        "Subscription not found",
        "Failed to create refund request",
      );
    }
  }

  /**
   * Gets all refund requests for a store
   * @param storeId - Store ID to fetch refund requests for
   * @returns Array of refund requests, empty if no subscription exists
   */
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
