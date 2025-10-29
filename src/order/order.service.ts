import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, OrderStatus, DiscountType, Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { ApplyDiscountDto } from "./dto/apply-discount.dto";
import { CheckoutCartDto } from "./dto/checkout-cart.dto";
import { KdsQueryDto } from "./dto/kds-query.dto";
import { OrderResponseDto } from "./dto/order-response.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { AuthService } from "../auth/auth.service";
import { PaginatedResponseDto } from "../common/dto/paginated-response.dto";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { KitchenGateway } from "../kitchen/gateway/kitchen.gateway";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kitchenGateway: KitchenGateway,
    private readonly authService: AuthService,
  ) {}

  /**
   * Checkout cart and create order
   * SECURITY FIX: Added authentication to prevent unauthorized order creation
   */
  async checkoutCart(
    sessionId: string,
    dto: CheckoutCartDto,
    sessionToken?: string,
    userId?: string,
  ): Promise<OrderResponseDto> {
    const method = this.checkoutCart.name;

    try {
      // Get session with table info
      const session = await this.prisma.activeTableSession.findUnique({
        where: { id: sessionId },
        include: {
          table: true,
          store: {
            include: {
              setting: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException("Session not found");
      }

      if (session.status === "CLOSED") {
        throw new BadRequestException("Session is already closed");
      }

      if (!session.table) {
        throw new BadRequestException("Session has no associated table");
      }

      // SECURITY FIX: Validate session ownership (customer with session token)
      if (sessionToken && session.sessionToken !== sessionToken) {
        this.logger.warn(
          `[${method}] Invalid session token for checkout on session ${sessionId}`,
        );
        throw new ForbiddenException("Invalid session token");
      }

      // SECURITY FIX: Validate staff store permission (staff with JWT)
      if (userId) {
        await this.authService.checkStorePermission(
          userId,
          session.table.storeId,
          [Role.OWNER, Role.ADMIN, Role.SERVER, Role.CASHIER, Role.CHEF],
        );
      }

      // SECURITY FIX: Require at least one auth method
      if (!sessionToken && !userId) {
        this.logger.warn(
          `[${method}] No authentication provided for checkout on session ${sessionId}`,
        );
        throw new UnauthorizedException(
          "Authentication required: Provide session token or JWT",
        );
      }

      // Get cart with items
      const cart = await this.prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: {
              customizations: true,
              menuItem: true,
            },
          },
        },
      });

      if (!cart) {
        throw new NotFoundException("Cart not found");
      }

      if (cart.items.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      // Get store settings for VAT and service charge
      const storeSetting = session.store.setting;
      const vatRate = storeSetting?.vatRate ?? new Decimal("0");
      const serviceChargeRate =
        storeSetting?.serviceChargeRate ?? new Decimal("0");

      // Use transaction to create order
      const order = await this.prisma.$transaction(async (tx) => {
        // Generate order number
        const orderNumber = await this.generateOrderNumber(tx, session.storeId);

        // Calculate totals
        const subTotal = new Decimal(cart.subTotal);
        const vatAmount = subTotal.mul(vatRate);
        const serviceChargeAmount = subTotal.mul(serviceChargeRate);
        const grandTotal = subTotal.add(vatAmount).add(serviceChargeAmount);

        // Create order
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            storeId: session.storeId,
            sessionId: session.id,
            tableName: dto.tableName ?? session.table?.name ?? "Counter Order",
            status: OrderStatus.PENDING,
            orderType: dto.orderType,
            subTotal,
            vatRateSnapshot: vatRate,
            serviceChargeRateSnapshot: serviceChargeRate,
            vatAmount,
            serviceChargeAmount,
            grandTotal,
          },
        });

        // Create order items from cart items
        for (const cartItem of cart.items) {
          // Calculate item price with customizations
          let itemPrice = new Decimal(cartItem.basePrice);
          for (const customization of cartItem.customizations) {
            if (customization.additionalPrice) {
              itemPrice = itemPrice.add(
                new Decimal(customization.additionalPrice),
              );
            }
          }

          const finalPrice = itemPrice.mul(cartItem.quantity);

          // Create order item
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              menuItemId: cartItem.menuItemId,
              price: itemPrice,
              quantity: cartItem.quantity,
              finalPrice,
              notes: cartItem.notes,
            },
          });

          // Create order item customizations
          if (cartItem.customizations.length > 0) {
            const customizationData = cartItem.customizations.map((c) => ({
              orderItemId: orderItem.id,
              customizationOptionId: c.customizationOptionId,
              finalPrice: c.additionalPrice
                ? new Decimal(c.additionalPrice).mul(cartItem.quantity)
                : null,
            }));

            await tx.orderItemCustomization.createMany({
              data: customizationData,
            });
          }
        }

        // Clear cart after successful checkout
        // NOTE: Hard delete is acceptable - cart items are transient and have been
        // converted to OrderItems (permanent records) above.
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        await tx.cart.update({
          where: { id: cart.id },
          data: { subTotal: new Decimal("0") },
        });

        return newOrder;
      });

      this.logger.log(
        `[${method}] Order ${order.orderNumber} created for session ${sessionId}`,
      );

      // Broadcast new order to kitchen screens
      await this.kitchenGateway.broadcastNewOrder(session.storeId, order.id);

      // Return full order with items
      return await this.findOne(order.id);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to checkout cart`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to create order");
    }
  }

  /**
   * Get order by ID with payment status
   */
  async findOne(orderId: string): Promise<OrderResponseDto> {
    const method = this.findOne.name;

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              customizations: true,
            },
          },
          payments: true,
          refunds: true,
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      // Calculate payment status inline (optimize to avoid double query)
      const totalPaid = (order.payments || []).reduce(
        (sum, payment) => sum.add(new Decimal(payment.amount)),
        new Decimal("0"),
      );

      const totalRefunded = (order.refunds || []).reduce(
        (sum, refund) => sum.add(new Decimal(refund.amount)),
        new Decimal("0"),
      );

      const netPaid = totalPaid.sub(totalRefunded);
      const grandTotal = new Decimal(order.grandTotal);
      const remainingBalance = grandTotal.sub(netPaid);
      const isPaidInFull = netPaid.greaterThanOrEqualTo(grandTotal);

      return {
        ...order,
        totalPaid: totalPaid.toFixed(2),
        remainingBalance: remainingBalance.toFixed(2),
        isPaidInFull,
      } as OrderResponseDto;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get order`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to retrieve order");
    }
  }

  /**
   * Get all orders for a store with pagination and payment status
   */
  async findByStore(
    storeId: string,
    paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const method = this.findByStore.name;

    try {
      const { skip, take, page, limit } = paginationDto;

      // Execute queries in parallel for better performance
      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where: { storeId },
          include: {
            orderItems: {
              include: {
                customizations: true,
              },
            },
            payments: true,
            refunds: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        this.prisma.order.count({
          where: { storeId },
        }),
      ]);

      // Enhance orders with payment status
      const enhancedOrders = orders.map((order) => {
        // Calculate payment status inline to avoid N+1 queries
        const totalPaid = (order.payments || []).reduce(
          (sum, payment) => sum.add(new Decimal(payment.amount)),
          new Decimal("0"),
        );

        const totalRefunded = (order.refunds || []).reduce(
          (sum, refund) => sum.add(new Decimal(refund.amount)),
          new Decimal("0"),
        );

        const netPaid = totalPaid.sub(totalRefunded);
        const grandTotal = new Decimal(order.grandTotal);
        const remainingBalance = grandTotal.sub(netPaid);
        const isPaidInFull = netPaid.greaterThanOrEqualTo(grandTotal);

        return {
          ...order,
          totalPaid: totalPaid.toFixed(2),
          remainingBalance: remainingBalance.toFixed(2),
          isPaidInFull,
        } as OrderResponseDto;
      });

      this.logger.log(
        `[${method}] Retrieved ${orders.length} orders for store ${storeId} (page ${page})`,
      );

      return PaginatedResponseDto.create(
        enhancedOrders,
        total,
        page ?? 1,
        limit ?? 20,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get orders`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to retrieve orders");
    }
  }

  /**
   * Get orders for Kitchen Display System (KDS) with filtering
   * Optimized for real-time kitchen operations with status filtering
   */
  async findForKds(
    queryDto: KdsQueryDto,
  ): Promise<PaginatedResponseDto<OrderResponseDto>> {
    const method = this.findForKds.name;

    try {
      const { storeId, status, skip, take, page, limit } = queryDto;

      // Build where clause for KDS-specific filtering
      const where: Prisma.OrderWhereInput = {
        storeId,
      };

      // Filter by status if provided, otherwise show active kitchen orders
      if (status) {
        where.status = status;
      } else {
        // Default: show orders that need kitchen attention
        where.status = {
          in: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY],
        };
      }

      // Execute queries in parallel with KDS-optimized indexes
      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          include: {
            orderItems: {
              include: {
                customizations: true,
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
            payments: true,
            refunds: true,
          },
          // Sort by status priority (PENDING first) then by creation time
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip,
          take,
        }),
        this.prisma.order.count({ where }),
      ]);

      // Enhance orders with payment status
      const enhancedOrders = orders.map((order) => {
        // Calculate payment status inline to avoid N+1 queries
        const totalPaid = (order.payments || []).reduce(
          (sum, payment) => sum.add(new Decimal(payment.amount)),
          new Decimal("0"),
        );

        const totalRefunded = (order.refunds || []).reduce(
          (sum, refund) => sum.add(new Decimal(refund.amount)),
          new Decimal("0"),
        );

        const netPaid = totalPaid.sub(totalRefunded);
        const grandTotal = new Decimal(order.grandTotal);
        const remainingBalance = grandTotal.sub(netPaid);
        const isPaidInFull = netPaid.greaterThanOrEqualTo(grandTotal);

        return {
          ...order,
          totalPaid: totalPaid.toFixed(2),
          remainingBalance: remainingBalance.toFixed(2),
          isPaidInFull,
        } as OrderResponseDto;
      });

      this.logger.log(
        `[${method}] Retrieved ${orders.length} KDS orders for store ${storeId} (page ${page}, status: ${status ?? "active"})`,
      );

      return PaginatedResponseDto.create(
        enhancedOrders,
        total,
        page ?? 1,
        limit ?? 20,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get KDS orders`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to retrieve KDS orders");
    }
  }

  /**
   * Get orders by session with payment status
   */
  async findBySession(sessionId: string): Promise<OrderResponseDto[]> {
    const method = this.findBySession.name;

    try {
      const orders = await this.prisma.order.findMany({
        where: { sessionId },
        include: {
          orderItems: {
            include: {
              customizations: true,
            },
          },
          payments: true,
          refunds: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Enhance orders with payment status
      const enhancedOrders = orders.map((order) => {
        // Calculate payment status inline to avoid N+1 queries
        const totalPaid = (order.payments || []).reduce(
          (sum, payment) => sum.add(new Decimal(payment.amount)),
          new Decimal("0"),
        );

        const totalRefunded = (order.refunds || []).reduce(
          (sum, refund) => sum.add(new Decimal(refund.amount)),
          new Decimal("0"),
        );

        const netPaid = totalPaid.sub(totalRefunded);
        const grandTotal = new Decimal(order.grandTotal);
        const remainingBalance = grandTotal.sub(netPaid);
        const isPaidInFull = netPaid.greaterThanOrEqualTo(grandTotal);

        return {
          ...order,
          totalPaid: totalPaid.toFixed(2),
          remainingBalance: remainingBalance.toFixed(2),
          isPaidInFull,
        } as OrderResponseDto;
      });

      return enhancedOrders;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get session orders`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Failed to retrieve session orders",
      );
    }
  }

  /**
   * Calculate payment status for an order
   * Supports bill splitting by calculating total paid across multiple payments
   */
  async getPaymentStatus(orderId: string): Promise<{
    totalPaid: Decimal;
    totalRefunded: Decimal;
    netPaid: Decimal;
    grandTotal: Decimal;
    remainingBalance: Decimal;
    isPaidInFull: boolean;
  }> {
    const method = this.getPaymentStatus.name;

    try {
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

      // Calculate total paid from all payments (supports split payments)
      const totalPaid = order.payments.reduce(
        (sum, payment) => sum.add(new Decimal(payment.amount)),
        new Decimal("0"),
      );

      // Calculate total refunded
      const totalRefunded = order.refunds.reduce(
        (sum, refund) => sum.add(new Decimal(refund.amount)),
        new Decimal("0"),
      );

      // Calculate net paid (total paid - refunds)
      const netPaid = totalPaid.sub(totalRefunded);

      const grandTotal = new Decimal(order.grandTotal);

      // Calculate remaining balance
      const remainingBalance = grandTotal.sub(netPaid);

      // Check if fully paid
      const isPaidInFull = netPaid.greaterThanOrEqualTo(grandTotal);

      this.logger.log(
        `[${method}] Payment status for order ${orderId}: totalPaid=${totalPaid.toFixed(2)}, netPaid=${netPaid.toFixed(2)}, remaining=${remainingBalance.toFixed(2)}, isPaidInFull=${isPaidInFull}`,
      );

      return {
        totalPaid: new Decimal(totalPaid.toFixed(2)),
        totalRefunded: new Decimal(totalRefunded.toFixed(2)),
        netPaid: new Decimal(netPaid.toFixed(2)),
        grandTotal,
        remainingBalance: new Decimal(remainingBalance.toFixed(2)),
        isPaidInFull,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get payment status`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Failed to calculate payment status",
      );
    }
  }

  /**
   * Update order status
   */
  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderResponseDto> {
    const method = this.updateStatus.name;

    try {
      // Validate order exists
      const existingOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        throw new NotFoundException("Order not found");
      }

      // Validate status transition
      this.validateStatusTransition(existingOrder.status, dto.status);

      // Update order
      const updateData: Prisma.OrderUpdateInput = {
        status: dto.status,
      };

      // If status is COMPLETED, set paidAt if not already set
      if (dto.status === OrderStatus.COMPLETED && !existingOrder.paidAt) {
        updateData.paidAt = new Date();
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      this.logger.log(
        `[${method}] Order ${orderId} status updated to ${dto.status}`,
      );

      // Broadcast status update to kitchen screens
      this.kitchenGateway.server
        .to(`store-${updatedOrder.storeId}`)
        .emit("kitchen:status-updated", {
          orderId,
          status: dto.status,
          paidAt: updatedOrder.paidAt,
        });

      // Special broadcast for READY status
      if (dto.status === OrderStatus.READY) {
        await this.kitchenGateway.broadcastOrderReady(
          updatedOrder.storeId,
          orderId,
        );
      }

      return await this.findOne(orderId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to update order status`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to update order status");
    }
  }

  /**
   * Apply discount to an order
   * Implements 3-tier authorization:
   * - Small (<10%): CASHIER, ADMIN, OWNER
   * - Medium (10-50%): ADMIN, OWNER
   * - Large (>50%): OWNER only
   */
  async applyDiscount(
    userId: string,
    storeId: string,
    orderId: string,
    dto: ApplyDiscountDto,
  ): Promise<OrderResponseDto> {
    const method = this.applyDiscount.name;

    try {
      // Fetch order with store validation
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { session: { include: { table: true } } },
      });

      if (
        !order ||
        !order.session?.table ||
        order.session.table.storeId !== storeId
      ) {
        throw new NotFoundException("Order not found in this store");
      }

      // Validate order is not paid
      const paymentStatus = await this.getPaymentStatus(orderId);
      if (paymentStatus.isPaidInFull) {
        throw new BadRequestException(
          "Cannot apply discount to fully paid order",
        );
      }

      // Calculate discount amount
      let discountAmount: Decimal;
      if (dto.discountType === DiscountType.PERCENTAGE) {
        const percentage = new Decimal(dto.discountValue);
        if (percentage.greaterThan(100)) {
          throw new BadRequestException("Percentage cannot exceed 100%");
        }
        discountAmount = new Decimal(order.subTotal)
          .mul(percentage)
          .dividedBy(100);
      } else {
        discountAmount = new Decimal(dto.discountValue);
        if (discountAmount.greaterThan(order.subTotal)) {
          throw new BadRequestException(
            "Discount amount cannot exceed subtotal",
          );
        }
      }

      // RBAC: Check discount authorization tier
      await this.validateDiscountAuthorization(
        userId,
        storeId,
        discountAmount,
        new Decimal(order.subTotal),
      );

      // Recalculate totals
      const newSubtotal = new Decimal(order.subTotal).minus(discountAmount);
      const taxRate = new Decimal(order.vatRateSnapshot ?? "0");
      const serviceChargeRate = new Decimal(
        order.serviceChargeRateSnapshot ?? "0",
      );

      const newTax = newSubtotal.mul(taxRate);
      const newServiceCharge = newSubtotal.mul(serviceChargeRate);
      const newGrandTotal = newSubtotal.add(newTax).add(newServiceCharge);

      // Update order
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          discountType: dto.discountType,
          discountValue: new Decimal(dto.discountValue),
          discountAmount,
          discountReason: dto.reason,
          discountAppliedBy: userId,
          discountAppliedAt: new Date(),
          vatAmount: newTax,
          serviceChargeAmount: newServiceCharge,
          grandTotal: newGrandTotal,
        },
      });

      this.logger.log(
        `[${method}] Applied ${dto.discountType} discount of ${discountAmount.toFixed(2)} to order ${orderId} by user ${userId}`,
      );

      return await this.findOne(orderId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to apply discount`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to apply discount");
    }
  }

  /**
   * Remove discount from an order
   * Requires ADMIN or OWNER permission
   */
  async removeDiscount(
    userId: string,
    storeId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const method = this.removeDiscount.name;

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { session: { include: { table: true } } },
      });

      if (
        !order ||
        !order.session?.table ||
        order.session.table.storeId !== storeId
      ) {
        throw new NotFoundException("Order not found in this store");
      }

      // Validate order is not paid
      const paymentStatus = await this.getPaymentStatus(orderId);
      if (paymentStatus.isPaidInFull) {
        throw new BadRequestException(
          "Cannot remove discount from fully paid order",
        );
      }

      // RBAC check - only ADMIN and OWNER can remove discounts
      await this.authService.checkStorePermission(userId, storeId, [
        Role.OWNER,
        Role.ADMIN,
      ]);

      // Recalculate without discount
      const originalSubtotal = new Decimal(order.subTotal);
      const taxRate = new Decimal(order.vatRateSnapshot ?? "0");
      const serviceChargeRate = new Decimal(
        order.serviceChargeRateSnapshot ?? "0",
      );

      const originalTax = originalSubtotal.mul(taxRate);
      const originalServiceCharge = originalSubtotal.mul(serviceChargeRate);
      const originalGrandTotal = originalSubtotal
        .add(originalTax)
        .add(originalServiceCharge);

      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          discountType: null,
          discountValue: null,
          discountAmount: null,
          discountReason: null,
          discountAppliedBy: null,
          discountAppliedAt: null,
          vatAmount: originalTax,
          serviceChargeAmount: originalServiceCharge,
          grandTotal: originalGrandTotal,
        },
      });

      this.logger.log(
        `[${method}] Removed discount from order ${orderId} by user ${userId}`,
      );

      return await this.findOne(orderId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to remove discount`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to remove discount");
    }
  }

  /**
   * Generate unique order number for store
   * @private
   */
  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
    storeId: string,
  ): Promise<string> {
    // Get today's date in YYYYMMDD format
    const today = new Date();
    const datePrefix = today.toISOString().split("T")[0].replace(/-/g, "");

    // Get count of orders for today
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const todayOrderCount = await tx.order.count({
      where: {
        storeId,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    // Generate order number: YYYYMMDD-001, YYYYMMDD-002, etc.
    const orderSequence = (todayOrderCount + 1).toString().padStart(3, "0");
    return `${datePrefix}-${orderSequence}`;
  }

  /**
   * Validate order status transitions
   * @private
   */
  private validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus,
  ): void {
    // Can't change cancelled orders
    if (currentStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException("Cannot update cancelled order");
    }

    // Can't change completed orders to anything except cancelled
    if (
      currentStatus === OrderStatus.COMPLETED &&
      newStatus !== OrderStatus.CANCELLED
    ) {
      throw new BadRequestException("Cannot update completed order");
    }

    // Valid transitions
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
      [OrderStatus.READY]: [OrderStatus.SERVED, OrderStatus.CANCELLED],
      [OrderStatus.SERVED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED]: [
        OrderStatus.CANCELLED, // Refund scenario
      ],
      [OrderStatus.CANCELLED]: [], // No transitions from cancelled
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  /**
   * Validate discount authorization based on 3-tier RBAC system
   * - Small discount (<10%): CASHIER, ADMIN, OWNER
   * - Medium discount (10-50%): ADMIN, OWNER
   * - Large discount (>50%): OWNER only
   * @private
   */
  private async validateDiscountAuthorization(
    userId: string,
    storeId: string,
    discountAmount: Decimal,
    subtotal: Decimal,
  ): Promise<void> {
    const percentage = discountAmount.dividedBy(subtotal).mul(100).toNumber();

    let requiredRoles: Role[];

    if (percentage < 10) {
      // Small discount: CASHIER, ADMIN, OWNER
      requiredRoles = [Role.OWNER, Role.ADMIN, Role.CASHIER];
      this.logger.log(
        `Validating small discount (<10%): ${percentage.toFixed(2)}% for user ${userId}`,
      );
    } else if (percentage < 50) {
      // Medium discount: ADMIN, OWNER
      requiredRoles = [Role.OWNER, Role.ADMIN];
      this.logger.log(
        `Validating medium discount (10-50%): ${percentage.toFixed(2)}% for user ${userId}`,
      );
    } else {
      // Large discount: OWNER only
      requiredRoles = [Role.OWNER];
      this.logger.log(
        `Validating large discount (>50%): ${percentage.toFixed(2)}% for user ${userId}`,
      );
    }

    await this.authService.checkStorePermission(userId, storeId, requiredRoles);
  }
}
