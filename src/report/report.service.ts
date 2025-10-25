import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatusReportDto,
  OrderStatusCountDto,
} from './dto/order-status-report.dto';
import {
  PaymentBreakdownDto,
  PaymentMethodBreakdownDto,
} from './dto/payment-breakdown.dto';
import { PopularItemDto, PopularItemsDto } from './dto/popular-items.dto';
import { SalesSummaryDto } from './dto/sales-summary.dto';

/**
 * Service for analytics and reporting with Redis caching
 * Cache TTL: 5 minutes (300 seconds)
 * Degrades gracefully if Redis unavailable
 */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get sales summary for a date range
   * @param storeId - Store ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Sales summary with totals and averages
   */
  async getSalesSummary(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesSummaryDto> {
    const method = this.getSalesSummary.name;

    // Generate cache key
    const cacheKey = `report:sales:${storeId}:${startDate.toISOString()}:${endDate.toISOString()}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<SalesSummaryDto>(cacheKey);
      if (cached) {
        this.logger.log(`[${method}] Cache hit for sales summary: ${cacheKey}`);
        return cached;
      }

      // Cache miss - query database
      this.logger.log(
        `[${method}] Cache miss - querying database for: ${cacheKey}`,
      );

      const where: Prisma.OrderWhereInput = {
        storeId,
        status: OrderStatus.COMPLETED, // Only completed orders count as sales
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      // Get aggregate data
      const aggregations = await this.prisma.order.aggregate({
        where,
        _sum: {
          grandTotal: true,
          vatAmount: true,
          serviceChargeAmount: true,
        },
        _count: true,
      });

      const totalSales = aggregations._sum.grandTotal ?? new Decimal('0');
      const orderCount = aggregations._count;
      const totalVat = aggregations._sum.vatAmount ?? new Decimal('0');
      const totalServiceCharge =
        aggregations._sum.serviceChargeAmount ?? new Decimal('0');

      // Calculate average order value
      const averageOrderValue =
        orderCount > 0 ? totalSales.div(orderCount) : new Decimal('0');

      const result: SalesSummaryDto = {
        totalSales,
        orderCount,
        averageOrderValue,
        totalVat,
        totalServiceCharge,
        startDate,
        endDate,
      };

      // Cache result for 5 minutes
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      this.logger.log(
        `[${method}] Sales summary generated for store ${storeId}: ${orderCount} orders, total ${totalSales.toString()}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to generate sales summary`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to generate sales summary',
      );
    }
  }

  /**
   * Get payment method breakdown
   * @param storeId - Store ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Breakdown by payment method
   */
  async getPaymentBreakdown(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentBreakdownDto> {
    const method = this.getPaymentBreakdown.name;

    // Generate cache key
    const cacheKey = `report:payment:${storeId}:${startDate.toISOString()}:${endDate.toISOString()}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<PaymentBreakdownDto>(cacheKey);
      if (cached) {
        this.logger.log(
          `[${method}] Cache hit for payment breakdown: ${cacheKey}`,
        );
        return cached;
      }

      // Cache miss - query database
      this.logger.log(
        `[${method}] Cache miss - querying database for: ${cacheKey}`,
      );

      // Get payments in date range
      const payments = await this.prisma.payment.groupBy({
        by: ['paymentMethod'],
        where: {
          order: {
            storeId,
            status: OrderStatus.COMPLETED,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        _sum: {
          amount: true,
        },
        _count: true,
      });

      // Calculate total for percentages
      const total = payments.reduce(
        (sum, p) => sum.add(p._sum.amount ?? new Decimal('0')),
        new Decimal('0'),
      );

      // Build breakdown with percentages
      const breakdown: PaymentMethodBreakdownDto[] = payments.map((p) => {
        const totalAmount = p._sum.amount ?? new Decimal('0');
        const percentage = total.gt(0)
          ? totalAmount.div(total).mul(100).toNumber()
          : 0;

        return {
          paymentMethod: p.paymentMethod,
          totalAmount,
          transactionCount: p._count,
          percentage: parseFloat(percentage.toFixed(2)),
        };
      });

      // Sort by total amount descending
      breakdown.sort((a, b) =>
        new Decimal(b.totalAmount).sub(a.totalAmount).toNumber(),
      );

      const result: PaymentBreakdownDto = {
        breakdown,
        startDate,
        endDate,
      };

      // Cache result for 5 minutes
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      this.logger.log(
        `[${method}] Payment breakdown generated for store ${storeId}: ${breakdown.length} payment methods`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to generate payment breakdown`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to generate payment breakdown',
      );
    }
  }

  /**
   * Get popular menu items
   * @param storeId - Store ID
   * @param limit - Number of items to return (default 10)
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Top selling items
   */
  async getPopularItems(
    storeId: string,
    limit: number = 10,
    startDate: Date,
    endDate: Date,
  ): Promise<PopularItemsDto> {
    const method = this.getPopularItems.name;

    // Generate cache key
    const cacheKey = `report:popular:${storeId}:${limit}:${startDate.toISOString()}:${endDate.toISOString()}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<PopularItemsDto>(cacheKey);
      if (cached) {
        this.logger.log(`[${method}] Cache hit for popular items: ${cacheKey}`);
        return cached;
      }

      // Cache miss - query database
      this.logger.log(
        `[${method}] Cache miss - querying database for: ${cacheKey}`,
      );

      // Get order items grouped by menu item
      const itemStats = await this.prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          order: {
            storeId,
            status: OrderStatus.COMPLETED,
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        _sum: {
          quantity: true,
          finalPrice: true,
        },
        _count: {
          orderId: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: limit,
      });

      // Filter out null menuItemIds and get menu item names
      const menuItemIds = itemStats
        .map((s) => s.menuItemId)
        .filter((id): id is string => id !== null);

      const menuItems = await this.prisma.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
        },
        select: {
          id: true,
          name: true,
        },
      });

      // Create lookup map
      const menuItemMap = new Map(menuItems.map((m) => [m.id, m.name]));

      // Build popular items list (filter out items with null menuItemId)
      const items: PopularItemDto[] = itemStats
        .filter(
          (s): s is typeof s & { menuItemId: string } => s.menuItemId !== null,
        )
        .map((s) => ({
          menuItemId: s.menuItemId,
          menuItemName: menuItemMap.get(s.menuItemId) ?? 'Unknown Item',
          quantitySold: s._sum.quantity ?? 0,
          totalRevenue: s._sum.finalPrice ?? new Decimal('0'),
          orderCount: s._count.orderId,
        }));

      const result: PopularItemsDto = {
        items,
        startDate,
        endDate,
      };

      // Cache result for 5 minutes
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      this.logger.log(
        `[${method}] Popular items generated for store ${storeId}: ${items.length} items`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to generate popular items report`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to generate popular items report',
      );
    }
  }

  /**
   * Get order status distribution
   * @param storeId - Store ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Order status breakdown
   */
  async getOrderStatusReport(
    storeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<OrderStatusReportDto> {
    const method = this.getOrderStatusReport.name;

    // Generate cache key
    const cacheKey = `report:status:${storeId}:${startDate.toISOString()}:${endDate.toISOString()}`;

    try {
      // Try cache first
      const cached =
        await this.cacheService.get<OrderStatusReportDto>(cacheKey);
      if (cached) {
        this.logger.log(
          `[${method}] Cache hit for order status report: ${cacheKey}`,
        );
        return cached;
      }

      // Cache miss - query database
      this.logger.log(
        `[${method}] Cache miss - querying database for: ${cacheKey}`,
      );

      // Get orders grouped by status
      const statusGroups = await this.prisma.order.groupBy({
        by: ['status'],
        where: {
          storeId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          _all: true,
        },
      });

      // Calculate total
      const totalOrders = statusGroups.reduce(
        (sum, g) => sum + (g._count._all || 0),
        0,
      );

      // Build status distribution with percentages
      const statusDistribution: OrderStatusCountDto[] = statusGroups.map(
        (g) => {
          const count = g._count._all || 0;
          const percentage = totalOrders > 0 ? (count / totalOrders) * 100 : 0;

          return {
            status: g.status,
            count,
            percentage: parseFloat(percentage.toFixed(2)),
          };
        },
      );

      // Sort by count descending
      statusDistribution.sort((a, b) => b.count - a.count);

      const result: OrderStatusReportDto = {
        statusDistribution,
        totalOrders,
        startDate,
        endDate,
      };

      // Cache result for 5 minutes
      await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

      this.logger.log(
        `[${method}] Order status report generated for store ${storeId}: ${totalOrders} total orders`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to generate order status report`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to generate order status report',
      );
    }
  }
}
