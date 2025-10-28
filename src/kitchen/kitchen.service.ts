import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { OrderStatus, Prisma, RoutingArea } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { KitchenOrderResponseDto } from "./dto/kitchen-order-response.dto";
import { UpdateKitchenStatusDto } from "./dto/update-kitchen-status.dto";

/**
 * Service for Kitchen Display System (KDS) functionality
 */
@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get orders by kitchen status for KDS
   * @param storeId - Store ID
   * @param status - Optional status filter
   * @param routingArea - Optional routing area filter
   * @returns List of orders for kitchen display
   */
  async getOrdersByStatus(
    storeId: string,
    status?: OrderStatus,
    routingArea?: RoutingArea,
  ): Promise<KitchenOrderResponseDto[]> {
    const method = this.getOrdersByStatus.name;

    try {
      const where: Prisma.OrderWhereInput = {
        storeId,
      };

      // Filter by status if provided
      if (status) {
        where.status = status;
      } else {
        // Default: Show orders that are in kitchen workflow
        where.status = {
          in: [
            OrderStatus.PENDING,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.SERVED,
          ],
        };
      }

      // Filter by routing area if provided
      if (routingArea) {
        where.orderItems = {
          some: {
            menuItem: {
              routingArea,
            },
          },
        };
      }

      const orders = await this.prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: {
                  name: true,
                  description: true,
                  routingArea: true,
                  preparationTimeMinutes: true,
                },
              },
              customizations: {
                include: {
                  customizationOption: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      });

      // If routingArea is specified, filter order items to only show items from that area
      let filteredOrders = orders;
      if (routingArea) {
        filteredOrders = orders.map((order) => ({
          ...order,
          orderItems: order.orderItems.filter(
            (item) => item.menuItem?.routingArea === routingArea,
          ),
        }));
      }

      this.logger.log(
        `[${method}] Retrieved ${filteredOrders.length} orders for store ${storeId}${status ? ` with status ${status}` : ""}${routingArea ? ` and routing area ${routingArea}` : ""}`,
      );

      return filteredOrders as KitchenOrderResponseDto[];
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get kitchen orders`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Failed to retrieve kitchen orders",
      );
    }
  }

  /**
   * Get single order details for KDS
   * @param orderId - Order ID
   * @returns Order details
   */
  async getOrderDetails(orderId: string): Promise<KitchenOrderResponseDto> {
    const method = this.getOrderDetails.name;

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          orderItems: {
            include: {
              menuItem: {
                select: {
                  name: true,
                  description: true,
                },
              },
              customizations: {
                include: {
                  customizationOption: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      this.logger.log(`[${method}] Retrieved order ${orderId} details`);

      return order as KitchenOrderResponseDto;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get order details`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Failed to retrieve order details",
      );
    }
  }

  /**
   * Update order kitchen status
   * @param orderId - Order ID
   * @param storeId - Store ID for validation
   * @param dto - Update status DTO
   * @returns Updated order
   */
  async updateOrderStatus(
    orderId: string,
    storeId: string,
    dto: UpdateKitchenStatusDto,
  ): Promise<KitchenOrderResponseDto> {
    const method = this.updateOrderStatus.name;

    try {
      // Validate order exists and belongs to store
      const existingOrder = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!existingOrder) {
        throw new NotFoundException("Order not found");
      }

      if (existingOrder.storeId !== storeId) {
        throw new BadRequestException("Order does not belong to this store");
      }

      // Validate status transition
      this.validateStatusTransition(existingOrder.status, dto.status);

      // Update order status
      const updateData: Prisma.OrderUpdateInput = {
        status: dto.status,
      };

      // If status is COMPLETED, set paidAt if not already set
      if (dto.status === OrderStatus.COMPLETED && !existingOrder.paidAt) {
        updateData.paidAt = new Date();
      }

      await this.prisma.order.update({
        where: { id: orderId },
        data: updateData,
      });

      this.logger.log(
        `[${method}] Order ${orderId} status updated to ${dto.status}`,
      );

      return await this.getOrderDetails(orderId);
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
}
