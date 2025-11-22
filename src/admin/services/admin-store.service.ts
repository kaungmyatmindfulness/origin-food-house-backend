import { Injectable, Logger, NotFoundException } from "@nestjs/common";

import {
  Prisma,
  SubscriptionStatus,
  SubscriptionTier,
} from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

import { SuspensionService } from "./suspension.service";
import { ListStoresDto } from "../dto/list-stores.dto";

@Injectable()
export class AdminStoreService {
  private readonly logger = new Logger(AdminStoreService.name);

  constructor(
    private prisma: PrismaService,
    private suspensionService: SuspensionService,
  ) {}

  async listStores(query: ListStoresDto) {
    const method = this.listStores.name;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.StoreWhereInput = {};

    if (query.search) {
      where.OR = [
        { slug: { contains: query.search, mode: "insensitive" } },
        {
          information: {
            name: { contains: query.search, mode: "insensitive" },
          },
        },
      ];
    }

    if (query.status) {
      where.subscription = {
        status: query.status as SubscriptionStatus,
      };
    }

    if (query.tierId) {
      if (where.subscription) {
        where.subscription.tier = query.tierId as SubscriptionTier;
      } else {
        where.subscription = {
          tier: query.tierId as SubscriptionTier,
        };
      }
    }

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        include: {
          information: true,
          subscription: true,
          tier: true,
          _count: {
            select: {
              userStores: true,
              orders: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.store.count({ where }),
    ]);

    this.logger.log(
      `[${method}] Retrieved ${stores.length} stores (total: ${total})`,
    );

    return {
      data: stores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStoreDetail(storeId: string) {
    const method = this.getStoreDetail.name;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        information: true,
        setting: true,
        subscription: true,
        tier: true,
        userStores: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                isSuspended: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            tables: true,
            menuItems: true,
            categories: true,
          },
        },
      },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    this.logger.log(`[${method}] Store detail retrieved for ${storeId}`);

    return store;
  }

  async suspendStore(adminUserId: string, storeId: string, reason: string) {
    return await this.suspensionService.suspendStore(
      adminUserId,
      storeId,
      reason,
    );
  }

  async banStore(adminUserId: string, storeId: string, reason: string) {
    return await this.suspensionService.banStore(adminUserId, storeId, reason);
  }

  async reactivateStore(adminUserId: string, storeId: string, note?: string) {
    return await this.suspensionService.reactivateStore(
      adminUserId,
      storeId,
      note,
    );
  }

  async downgradeTier(
    adminUserId: string,
    storeId: string,
    targetTier: SubscriptionTier,
    reason: string,
  ) {
    const method = this.downgradeTier.name;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { tier: true, subscription: true },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    await this.prisma.$transaction(async (tx) => {
      if (store.subscription) {
        await tx.subscription.update({
          where: { id: store.subscription.id },
          data: {
            tier: targetTier,
            overriddenBy: adminUserId,
            overrideReason: reason,
            overriddenAt: new Date(),
          },
        });
      }

      if (store.tier) {
        await tx.storeTier.update({
          where: { id: store.tier.id },
          data: {
            tier: targetTier,
          },
        });
      } else {
        await tx.storeTier.create({
          data: {
            storeId,
            tier: targetTier,
          },
        });
      }
    });

    this.logger.log(
      `[${method}] Store ${storeId} downgraded to tier ${targetTier} by admin ${adminUserId}`,
    );

    return await this.getStoreDetail(storeId);
  }

  async getStoreAnalytics(storeId: string) {
    const method = this.getStoreAnalytics.name;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    const [totalOrders, totalRevenue, activeUsers, suspensionHistory] =
      await Promise.all([
        this.prisma.order.count({
          where: { storeId, status: { not: "CANCELLED" } },
        }),
        this.prisma.order.aggregate({
          where: { storeId, status: "COMPLETED" },
          _sum: {
            grandTotal: true,
          },
        }),
        this.prisma.userStore.count({
          where: { storeId },
        }),
        this.prisma.storeSuspension.findMany({
          where: { storeId },
          include: {
            suspendedByAdmin: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            reactivatedByAdmin: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
          orderBy: { suspendedAt: "desc" },
          take: 10,
        }),
      ]);

    const analytics = {
      totalOrders,
      totalRevenue: totalRevenue._sum.grandTotal?.toNumber() ?? 0,
      activeUsers,
      suspensionHistory,
    };

    this.logger.log(`[${method}] Analytics retrieved for store ${storeId}`);

    return analytics;
  }
}
