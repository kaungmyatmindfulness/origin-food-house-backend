import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { StoreTier, Tier } from "@prisma/client";

import { CacheService } from "../common/cache/cache.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  StoreUsageDto,
  ResourceUsageDto,
  UsageBreakdownDto,
  FeatureAccessDto,
} from "./dto/store-usage.dto";

/**
 * Tier limits configuration
 * FREE: Basic tier for small restaurants
 * STANDARD: Mid-tier with KDS access
 * PREMIUM: Full-featured tier with advanced analytics
 */
export const TIER_LIMITS = {
  FREE: {
    maxTables: 20,
    maxMenuItems: 50,
    maxStaff: 10,
    maxMonthlyOrders: 2000,
    features: {
      kds: false,
      loyalty: false,
      advancedReports: false,
    },
  },
  STANDARD: {
    maxTables: Infinity,
    maxMenuItems: Infinity,
    maxStaff: 20,
    maxMonthlyOrders: 20000,
    features: {
      kds: true,
      loyalty: true,
      advancedReports: false,
    },
  },
  PREMIUM: {
    maxTables: Infinity,
    maxMenuItems: Infinity,
    maxStaff: Infinity,
    maxMonthlyOrders: Infinity,
    features: {
      kds: true,
      loyalty: true,
      advancedReports: true,
    },
  },
};

export interface TierUsage {
  tables: number;
  menuItems: number;
  staff: number;
  monthlyOrders: number;
}

@Injectable()
export class TierService {
  private readonly logger = new Logger(TierService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Get store tier information
   * @param storeId Store ID
   * @returns StoreTier object or null if not found
   */
  async getStoreTier(storeId: string): Promise<StoreTier | null> {
    const method = this.getStoreTier.name;

    try {
      const tier = await this.prisma.storeTier.findUnique({
        where: { storeId },
      });

      if (!tier) {
        this.logger.warn(`[${method}] No tier found for store: ${storeId}`);
        return null;
      }

      return tier;
    } catch (error) {
      this.logger.error(
        `[${method}] Error fetching tier for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Get current usage for a store (cached for 5 minutes)
   * Returns enhanced usage breakdown with limits and feature access
   * @param storeId Store ID
   * @returns StoreUsageDto with resource breakdown and feature flags
   */
  async getStoreUsage(storeId: string): Promise<StoreUsageDto> {
    const method = this.getStoreUsage.name;
    const cacheKey = `tier:usage:${storeId}`;

    try {
      // Try cache first
      const cached = await this.cacheService.get<StoreUsageDto>(cacheKey);
      if (cached) {
        this.logger.debug(`[${method}] Cache hit for store ${storeId}`);
        return cached;
      }

      // Get tier information
      const tier = await this.getStoreTier(storeId);
      if (!tier) {
        throw new NotFoundException(`Store tier not found for ${storeId}`);
      }

      const limits = TIER_LIMITS[tier.tier];

      // Calculate usage (run in parallel for performance)
      const [tableCount, menuItemCount, staffCount, orderCount] =
        await Promise.all([
          this.prisma.table.count({ where: { storeId } }),
          this.prisma.menuItem.count({ where: { storeId, deletedAt: null } }),
          this.prisma.userStore.count({ where: { storeId } }),
          this.getMonthlyOrderCount(storeId),
        ]);

      // Build usage DTO
      const usage: StoreUsageDto = {
        tier: tier.tier,
        usage: {
          tables: {
            current: tableCount,
            limit: limits.maxTables,
          } as ResourceUsageDto,
          menuItems: {
            current: menuItemCount,
            limit: limits.maxMenuItems,
          } as ResourceUsageDto,
          staff: {
            current: staffCount,
            limit: limits.maxStaff,
          } as ResourceUsageDto,
          monthlyOrders: {
            current: orderCount,
            limit: limits.maxMonthlyOrders,
          } as ResourceUsageDto,
        } as UsageBreakdownDto,
        features: {
          kds: limits.features.kds,
          loyalty: limits.features.loyalty,
          advancedReports: limits.features.advancedReports,
        } as FeatureAccessDto,
      };

      // Cache for 5 minutes
      await this.cacheService.set(cacheKey, usage, 300);

      this.logger.log(
        `[${method}] Usage retrieved for store ${storeId}: ${tableCount} tables, ${menuItemCount} items, ${staffCount} staff`,
      );
      return usage;
    } catch (error) {
      this.logger.error(
        `[${method}] Error calculating usage for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Helper method to get monthly order count
   * @private
   */
  private async getMonthlyOrderCount(storeId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return await this.prisma.order.count({
      where: {
        storeId,
        createdAt: { gte: startOfMonth },
      },
    });
  }

  /**
   * Check if store can perform action based on tier limits
   * @param storeId Store ID
   * @param resource Resource type ('tables', 'menuItems', 'staff', 'ordersThisMonth')
   * @param increment Number to add (default 1)
   * @returns { allowed: boolean, currentUsage: number, limit: number, tier: Tier }
   */
  async checkTierLimit(
    storeId: string,
    resource: keyof TierUsage,
    increment = 1,
  ): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    tier: Tier;
  }> {
    const method = this.checkTierLimit.name;

    try {
      // Get tier
      const storeTier = await this.getStoreTier(storeId);
      if (!storeTier) {
        throw new NotFoundException(`Store tier not found for ${storeId}`);
      }

      // Get current usage
      const usage = await this.getStoreUsage(storeId);
      const resourceUsage = usage.usage[resource];
      const currentUsage = resourceUsage.current;
      const { limit } = resourceUsage;

      const allowed = currentUsage + increment <= limit;

      this.logger.log(
        `[${method}] Store ${storeId} (${storeTier.tier}): ${resource} check - ` +
          `current: ${currentUsage}, increment: ${increment}, limit: ${limit}, allowed: ${allowed}`,
      );

      return {
        allowed,
        currentUsage,
        limit,
        tier: storeTier.tier,
      };
    } catch (error) {
      this.logger.error(
        `[${method}] Error checking tier limit for store ${storeId}, resource: ${resource}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Check if store has access to a feature
   * @param storeId Store ID
   * @param feature Feature name ('kds', 'loyalty', 'advancedReports')
   * @returns boolean
   */
  async hasFeatureAccess(
    storeId: string,
    feature: keyof (typeof TIER_LIMITS)["FREE"]["features"],
  ): Promise<boolean> {
    const method = this.hasFeatureAccess.name;

    try {
      const storeTier = await this.getStoreTier(storeId);
      if (!storeTier) {
        throw new NotFoundException(`Store tier not found for ${storeId}`);
      }

      const hasAccess = TIER_LIMITS[storeTier.tier].features[feature];

      this.logger.log(
        `[${method}] Store ${storeId} (${storeTier.tier}): ${feature} access = ${hasAccess}`,
      );

      return hasAccess;
    } catch (error) {
      this.logger.error(
        `[${method}] Error checking feature access for store ${storeId}, feature: ${feature}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Invalidate usage cache for a store
   * Call this after creating/deleting resources (tables, items, staff, orders)
   * @param storeId Store ID
   */
  async invalidateUsageCache(storeId: string): Promise<void> {
    const method = this.invalidateUsageCache.name;
    const cacheKey = `tier:usage:${storeId}`;

    try {
      await this.cacheService.del(cacheKey);
      this.logger.debug(
        `[${method}] Invalidated usage cache for store ${storeId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Error invalidating cache for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      // Don't throw - cache invalidation failure shouldn't break the app
    }
  }

  /**
   * Track resource usage changes (creation/deletion)
   * Invalidates cache to ensure fresh usage data
   * @param storeId Store ID
   * @param resource Resource type
   * @param delta Change in resource count (positive for creation, negative for deletion)
   */
  async trackUsage(
    storeId: string,
    resource: keyof TierUsage,
    delta: number,
  ): Promise<void> {
    const method = this.trackUsage.name;

    // Invalidate cache to force fresh calculation
    await this.invalidateUsageCache(storeId);

    this.logger.debug(
      `[${method}] Cache invalidated for ${storeId} after ${resource} change (${delta > 0 ? "+" : ""}${delta})`,
    );
  }

  /**
   * Alias for hasFeatureAccess to match documentation
   * Check if store has access to a specific feature
   * @param storeId Store ID
   * @param feature Feature name
   * @returns boolean indicating access
   */
  async checkFeatureAccess(
    storeId: string,
    feature: keyof (typeof TIER_LIMITS)["FREE"]["features"],
  ): Promise<boolean> {
    return await this.hasFeatureAccess(storeId, feature);
  }
}
