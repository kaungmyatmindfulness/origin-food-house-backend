import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from "@nestjs/common";

import { Decimal } from "src/common/types/decimal.type";
import {
  Prisma,
  OrderStatus,
  Role,
  Order,
  PaymentMethod,
} from "src/generated/prisma/client";

import { AuditLogService } from "../audit-log/audit-log.service";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRefundDto } from "./dto/create-refund.dto";
import {
  PaymentResponseDto,
  RefundResponseDto,
} from "./dto/payment-response.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { RecordSplitPaymentDto } from "./dto/record-split-payment.dto";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Validates that a user has permission to access an order's store
   * @param orderId - The order ID to validate
   * @param userId - The user ID making the request
   * @param allowedRoles - Roles that are authorized for this operation
   * @returns The order with store information
   * @throws {NotFoundException} If order doesn't exist
   * @throws {ForbiddenException} If user doesn't have permission
   */
  private async validateOrderStoreAccess(
    orderId: string,
    userId: string,
    allowedRoles: Role[],
  ): Promise<Order> {
    const method = "validateOrderStoreAccess";

    // Fetch order with store information
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        storeId: true,
        tableName: true,
        grandTotal: true,
        paidAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!order) {
      this.logger.warn(`[${method}] Order ${orderId} not found`);
      throw new NotFoundException("Order not found");
    }

    // Validate user has permission to the order's store
    await this.authService.checkStorePermission(
      userId,
      order.storeId,
      allowedRoles,
    );

    this.logger.log(
      `[${method}] User ${userId} validated for order ${orderId} in store ${order.storeId}`,
    );

    return order as Order;
  }

  /**
   * Record payment for an order
   */
  async recordPayment(
    userId: string,
    orderId: string,
    dto: RecordPaymentDto,
  ): Promise<PaymentResponseDto> {
    const method = this.recordPayment.name;

    try {
      // Validate store access - only OWNER, ADMIN, CASHIER can record payments
      await this.validateOrderStoreAccess(orderId, userId, [
        Role.OWNER,
        Role.ADMIN,
        Role.CASHIER,
      ]);

      // Get order with payments
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          payments: true,
          refunds: true,
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          "Cannot accept payment for cancelled order",
        );
      }

      // Calculate total paid and refunded
      const totalPaid = order.payments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount)),
        new Decimal("0"),
      );

      const totalRefunded = order.refunds.reduce(
        (sum, r) => sum.add(new Decimal(r.amount)),
        new Decimal("0"),
      );

      const netPaid = totalPaid.sub(totalRefunded);
      const paymentAmount = new Decimal(dto.amount);
      const newTotalPaid = netPaid.add(paymentAmount);
      const grandTotal = new Decimal(order.grandTotal);

      // Validate payment amount - prevent overpayment
      if (newTotalPaid.greaterThan(grandTotal)) {
        const remaining = grandTotal.sub(netPaid);
        this.logger.warn(
          `[${method}] Payment rejected - amount exceeds remaining balance. Order ${orderId}: grandTotal=${grandTotal.toString()}, alreadyPaid=${netPaid.toString()}, attempted=${paymentAmount.toString()}, remaining=${remaining.toString()}`,
        );
        throw new BadRequestException(
          `Payment amount exceeds order total. Remaining balance: ${remaining.toString()}, attempted payment: ${paymentAmount.toString()}`,
        );
      }

      // Log split payment information
      const paymentsCount = order.payments.length;
      if (paymentsCount > 0 || paymentAmount.lessThan(grandTotal)) {
        this.logger.log(
          `[${method}] Split payment detected for order ${orderId}: payment ${paymentsCount + 1}, amount=${paymentAmount.toString()}, totalPaid=${newTotalPaid.toString()}, grandTotal=${grandTotal.toString()}, remaining=${grandTotal.sub(newTotalPaid).toString()}`,
        );
      }

      // Validate and calculate change for cash payments
      let amountTendered: Decimal | undefined;
      let change: Decimal | undefined;

      if (dto.paymentMethod === PaymentMethod.CASH) {
        if (dto.amountTendered) {
          amountTendered = new Decimal(dto.amountTendered);

          // Validate amount tendered is sufficient
          if (amountTendered.lessThan(paymentAmount)) {
            throw new BadRequestException(
              `Insufficient amount tendered. Required: ${paymentAmount.toString()}, Tendered: ${amountTendered.toString()}`,
            );
          }

          // Calculate change
          change = amountTendered.sub(paymentAmount);

          this.logger.log(
            `[${method}] Cash payment: amount=${paymentAmount.toString()}, tendered=${amountTendered.toString()}, change=${change.toString()}`,
          );
        }
      } else if (dto.amountTendered) {
        // amountTendered should only be provided for cash payments
        this.logger.warn(
          `[${method}] amountTendered provided for non-cash payment method: ${dto.paymentMethod}`,
        );
        throw new BadRequestException(
          "amountTendered is only applicable for cash payments",
        );
      }

      // Use transaction to record payment and update order
      const payment = await this.prisma.$transaction(async (tx) => {
        // Create payment record
        const newPayment = await tx.payment.create({
          data: {
            orderId,
            amount: paymentAmount,
            paymentMethod: dto.paymentMethod,
            amountTendered,
            change,
            transactionId: dto.transactionId,
            notes: dto.notes,
          },
        });

        // Update order status if fully paid
        if (newTotalPaid.equals(grandTotal)) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              paidAt: new Date(),
              status:
                order.status === OrderStatus.SERVED
                  ? OrderStatus.COMPLETED
                  : order.status,
            },
          });

          this.logger.log(
            `[${method}] Order ${orderId} in store ${order.storeId} fully paid`,
          );
        }

        return newPayment;
      });

      this.logger.log(
        `[${method}] User ${userId} recorded payment of ${dto.amount} for order ${orderId} in store ${order.storeId}`,
      );

      return payment as PaymentResponseDto;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to record payment`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          throw new BadRequestException("Invalid order reference");
        }
      }

      throw new InternalServerErrorException("Failed to record payment");
    }
  }

  /**
   * Get all payments for an order
   */
  async findPaymentsByOrder(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto[]> {
    const method = this.findPaymentsByOrder.name;

    try {
      // Validate store access - OWNER, ADMIN, CASHIER can view payments
      await this.validateOrderStoreAccess(orderId, userId, [
        Role.OWNER,
        Role.ADMIN,
        Role.CASHIER,
      ]);

      const payments = await this.prisma.payment.findMany({
        where: { orderId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      });

      this.logger.log(
        `[${method}] User ${userId} retrieved ${payments.length} payments for order ${orderId}`,
      );

      return payments as PaymentResponseDto[];
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get payments`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to retrieve payments");
    }
  }

  /**
   * Create refund for an order
   */
  async createRefund(
    userId: string,
    orderId: string,
    dto: CreateRefundDto,
  ): Promise<RefundResponseDto> {
    const method = this.createRefund.name;

    try {
      // Validate store access - only OWNER, ADMIN can issue refunds
      await this.validateOrderStoreAccess(orderId, userId, [
        Role.OWNER,
        Role.ADMIN,
      ]);

      // Get order with payments and refunds
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          payments: true,
          refunds: true,
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Calculate refundable amount
      const totalPaid = order.payments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount)),
        new Decimal("0"),
      );

      const totalRefunded = order.refunds.reduce(
        (sum, r) => sum.add(new Decimal(r.amount)),
        new Decimal("0"),
      );

      const refundableAmount = totalPaid.sub(totalRefunded);
      const refundAmount = new Decimal(dto.amount);

      // Validate refund amount
      if (refundAmount.greaterThan(refundableAmount)) {
        throw new BadRequestException(
          `Refund amount exceeds refundable amount. Available: ${refundableAmount.toString()}`,
        );
      }

      if (refundAmount.lessThanOrEqualTo(new Decimal("0"))) {
        throw new BadRequestException("Refund amount must be positive");
      }

      // Create refund record
      const refund = await this.prisma.refund.create({
        data: {
          orderId,
          amount: refundAmount,
          reason: dto.reason,
          refundedBy: dto.refundedBy,
        },
      });

      this.logger.log(
        `[${method}] User ${userId} created refund of ${dto.amount} for order ${orderId} in store ${order.storeId}`,
      );

      // Audit log the refund
      await this.auditLogService.logPaymentRefund(
        order.storeId,
        userId,
        refund.id,
        {
          amount: dto.amount,
          reason: dto.reason ?? "No reason provided",
          orderId,
        },
      );

      return refund as RefundResponseDto;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to create refund`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          throw new BadRequestException("Invalid order reference");
        }
      }

      throw new InternalServerErrorException("Failed to create refund");
    }
  }

  /**
   * Get all refunds for an order
   */
  async findRefundsByOrder(
    userId: string,
    orderId: string,
  ): Promise<RefundResponseDto[]> {
    const method = this.findRefundsByOrder.name;

    try {
      // Validate store access - OWNER, ADMIN can view refunds
      await this.validateOrderStoreAccess(orderId, userId, [
        Role.OWNER,
        Role.ADMIN,
      ]);

      const refunds = await this.prisma.refund.findMany({
        where: { orderId },
        orderBy: { createdAt: "desc" },
      });

      this.logger.log(
        `[${method}] User ${userId} retrieved ${refunds.length} refunds for order ${orderId}`,
      );

      return refunds as RefundResponseDto[];
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get refunds`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to retrieve refunds");
    }
  }

  /**
   * Get payment summary for an order
   */
  async getPaymentSummary(
    userId: string,
    orderId: string,
  ): Promise<{
    grandTotal: Decimal;
    totalPaid: Decimal;
    totalRefunded: Decimal;
    netPaid: Decimal;
    remainingBalance: Decimal;
    isFullyPaid: boolean;
  }> {
    const method = this.getPaymentSummary.name;

    try {
      // Validate store access - OWNER, ADMIN, CASHIER can view payment summaries
      await this.validateOrderStoreAccess(orderId, userId, [
        Role.OWNER,
        Role.ADMIN,
        Role.CASHIER,
      ]);

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          payments: true,
          refunds: true,
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const grandTotal = new Decimal(order.grandTotal);

      const totalPaid = order.payments.reduce(
        (sum, p) => sum.add(new Decimal(p.amount)),
        new Decimal("0"),
      );

      const totalRefunded = order.refunds.reduce(
        (sum, r) => sum.add(new Decimal(r.amount)),
        new Decimal("0"),
      );

      const netPaid = totalPaid.sub(totalRefunded);
      const remainingBalance = grandTotal.sub(netPaid);
      const isFullyPaid = netPaid.equals(grandTotal);

      this.logger.log(
        `[${method}] User ${userId} retrieved payment summary for order ${orderId} in store ${order.storeId}`,
      );

      return {
        grandTotal,
        totalPaid,
        totalRefunded,
        netPaid,
        remainingBalance,
        isFullyPaid,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get payment summary`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Failed to retrieve payment summary",
      );
    }
  }

  /**
   * Get total amount paid for an order (excluding refunds)
   * @private
   */
  private async getTotalPaid(orderId: string): Promise<Decimal> {
    const payments = await this.prisma.payment.findMany({
      where: { orderId, deletedAt: null },
    });

    return payments.reduce(
      (sum, p) => sum.add(new Decimal(p.amount)),
      new Decimal("0"),
    );
  }

  /**
   * Calculate split amounts for an order
   * @param orderId - The order ID to split
   * @param splitType - Type of split (EVEN, BY_ITEM, CUSTOM)
   * @param splitData - Data specific to the split type
   * @returns Calculated split amounts with order details
   */
  async calculateSplitAmounts(
    orderId: string,
    splitType: "EVEN" | "BY_ITEM" | "CUSTOM",
    splitData: Record<string, unknown>,
  ): Promise<{
    splits: { guestNumber: number; amount: Decimal }[];
    remaining: Decimal;
    alreadyPaid: Decimal;
    grandTotal: Decimal;
  }> {
    const method = this.calculateSplitAmounts.name;

    // Fetch order with orderItems and payments
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
        payments: {
          where: { deletedAt: null },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const grandTotal = new Decimal(order.grandTotal);
    const alreadyPaid = order.payments.reduce(
      (sum: Decimal, p) => sum.add(new Decimal(p.amount)),
      new Decimal("0"),
    );
    const remaining = grandTotal.sub(alreadyPaid);

    let splits: { guestNumber: number; amount: Decimal }[] = [];

    switch (splitType) {
      case "EVEN": {
        const guestCount = (splitData.guestCount as number | undefined) ?? 2;
        if (guestCount < 2) {
          throw new BadRequestException("Guest count must be at least 2");
        }
        const perGuest = remaining.dividedBy(guestCount);
        splits = Array.from({ length: guestCount }, (_, i) => ({
          guestNumber: i + 1,
          amount: perGuest,
        }));
        break;
      }

      case "BY_ITEM": {
        // Group items by guest assignment
        const itemAssignments =
          (splitData.itemAssignments as Record<string, string[]> | undefined) ??
          {};
        const guestNumbers = Object.keys(itemAssignments);

        if (guestNumbers.length === 0) {
          throw new BadRequestException(
            "Item assignments required for BY_ITEM split",
          );
        }

        // Calculate proportional amounts based on item assignments
        const itemsByGuest = guestNumbers.map((guestNum) => {
          const assignedItems = itemAssignments[guestNum] ?? [];
          const guestTotal = order.orderItems
            .filter((item) => assignedItems.includes(item.id))
            .reduce(
              (sum: Decimal, item) =>
                sum.add(
                  new Decimal(item.finalPrice ?? item.price).mul(item.quantity),
                ),
              new Decimal("0"),
            );

          return {
            guestNumber: parseInt(guestNum.replace("guest", ""), 10),
            amount: guestTotal,
          };
        });

        splits = itemsByGuest;
        break;
      }

      case "CUSTOM": {
        const customAmounts =
          (splitData.customAmounts as string[] | undefined) ?? [];
        if (customAmounts.length === 0) {
          throw new BadRequestException(
            "Custom amounts required for CUSTOM split",
          );
        }

        splits = customAmounts.map((amt: string, i: number) => ({
          guestNumber: i + 1,
          amount: new Decimal(amt),
        }));
        break;
      }

      default:
        throw new BadRequestException(
          `Invalid split type: ${splitType as string}`,
        );
    }

    // Validate total doesn't exceed remaining
    const total = splits.reduce(
      (sum, s) => sum.add(s.amount),
      new Decimal("0"),
    );
    if (total.greaterThan(remaining)) {
      this.logger.warn(
        `[${method}] Split total (${total.toString()}) exceeds remaining balance (${remaining.toString()}) for order ${orderId}`,
      );
      throw new BadRequestException(
        `Split total (${total.toString()}) exceeds remaining balance (${remaining.toString()})`,
      );
    }

    this.logger.log(
      `[${method}] Calculated ${splitType} split for order ${orderId}: ${splits.length} guests, total=${total.toString()}, remaining=${remaining.toString()}`,
    );

    return { splits, remaining, alreadyPaid, grandTotal };
  }

  /**
   * Record a split payment for an order
   * @param userId - User ID making the request
   * @param orderId - Order ID to record payment for
   * @param dto - Split payment details
   * @returns Created payment record
   */
  async recordSplitPayment(
    userId: string,
    orderId: string,
    dto: RecordSplitPaymentDto,
  ): Promise<PaymentResponseDto> {
    const method = this.recordSplitPayment.name;

    try {
      // Validate store access - only OWNER, ADMIN, CASHIER can record payments
      const order = await this.validateOrderStoreAccess(orderId, userId, [
        Role.OWNER,
        Role.ADMIN,
        Role.CASHIER,
      ]);

      // Get order with payments to validate overpayment
      const fullOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: { where: { deletedAt: null } } },
      });

      if (!fullOrder) {
        throw new NotFoundException("Order not found");
      }

      if (fullOrder.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          "Cannot accept payment for cancelled order",
        );
      }

      // Calculate totals to prevent overpayment
      const alreadyPaid = await this.getTotalPaid(orderId);
      const paymentAmount = new Decimal(dto.amount);
      const newTotal = alreadyPaid.add(paymentAmount);
      const grandTotal = new Decimal(order.grandTotal);

      if (newTotal.greaterThan(grandTotal)) {
        this.logger.warn(
          `[${method}] Split payment rejected - overpayment. Order ${orderId}: grandTotal=${grandTotal.toString()}, alreadyPaid=${alreadyPaid.toString()}, attempted=${paymentAmount.toString()}`,
        );
        throw new BadRequestException(
          `Total paid (${newTotal.toString()}) would exceed order total (${grandTotal.toString()})`,
        );
      }

      // Validate and calculate change for cash payments
      let amountTendered: Decimal | undefined;
      let change: Decimal | undefined;

      if (dto.paymentMethod === PaymentMethod.CASH) {
        if (dto.amountTendered) {
          amountTendered = new Decimal(dto.amountTendered);

          if (amountTendered.lessThan(paymentAmount)) {
            throw new BadRequestException(
              `Insufficient amount tendered. Required: ${paymentAmount.toString()}, Tendered: ${amountTendered.toString()}`,
            );
          }

          change = amountTendered.sub(paymentAmount);
        }
      } else if (dto.amountTendered) {
        throw new BadRequestException(
          "amountTendered is only applicable for cash payments",
        );
      }

      // Record payment with split metadata
      const payment = await this.prisma.$transaction(async (tx) => {
        const newPayment = await tx.payment.create({
          data: {
            orderId,
            amount: paymentAmount,
            paymentMethod: dto.paymentMethod,
            amountTendered,
            change,
            transactionId: dto.transactionId,
            notes: `Split payment - Guest ${dto.guestNumber}`,
            splitType: dto.splitType,
            splitMetadata: dto.splitMetadata as Prisma.InputJsonValue,
            guestNumber: dto.guestNumber,
          },
        });

        // Update order payment status if fully paid
        const totalPaid = newTotal;
        if (totalPaid.equals(grandTotal)) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              paidAt: new Date(),
              status:
                fullOrder.status === OrderStatus.SERVED
                  ? OrderStatus.COMPLETED
                  : fullOrder.status,
            },
          });

          this.logger.log(
            `[${method}] Order ${orderId} in store ${order.storeId} fully paid via split payments`,
          );
        } else {
          this.logger.log(
            `[${method}] Split payment ${dto.guestNumber} recorded for order ${orderId}: ${paymentAmount.toString()} of ${grandTotal.toString()}, remaining=${grandTotal.sub(totalPaid).toString()}`,
          );
        }

        return newPayment;
      });

      this.logger.log(
        `[${method}] User ${userId} recorded split payment ${payment.id} for order ${orderId} in store ${order.storeId}`,
      );

      return payment as PaymentResponseDto;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to record split payment`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          throw new BadRequestException("Invalid order reference");
        }
      }

      throw new InternalServerErrorException("Failed to record split payment");
    }
  }
}
