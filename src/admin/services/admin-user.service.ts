import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "src/prisma/prisma.service";

import { SuspensionService } from "./suspension.service";
import { ListUsersDto } from "../dto/list-users.dto";

@Injectable()
export class AdminUserService {
  private readonly logger = new Logger(AdminUserService.name);

  constructor(
    private prisma: PrismaService,
    private suspensionService: SuspensionService,
  ) {}

  async listUsers(query: ListUsersDto) {
    const method = this.listUsers.name;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: "insensitive" } },
        { name: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query.isSuspended !== undefined) {
      where.isSuspended = query.isSuspended;
    }

    if (query.storeId) {
      where.userStores = {
        some: {
          storeId: query.storeId,
        },
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          userStores: {
            include: {
              store: {
                select: {
                  id: true,
                  slug: true,
                  information: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              userStores: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    this.logger.log(
      `[${method}] Retrieved ${users.length} users (total: ${total})`,
    );

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetail(userId: string) {
    const method = this.getUserDetail.name;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userStores: {
          include: {
            store: {
              select: {
                id: true,
                slug: true,
                information: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            userStores: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    this.logger.log(`[${method}] User detail retrieved for ${userId}`);

    return user;
  }

  async suspendUser(adminUserId: string, userId: string, reason: string) {
    return await this.suspensionService.suspendUser(
      adminUserId,
      userId,
      reason,
    );
  }

  async banUser(adminUserId: string, userId: string, reason: string) {
    return await this.suspensionService.banUser(adminUserId, userId, reason);
  }

  async reactivateUser(adminUserId: string, userId: string, note?: string) {
    return await this.suspensionService.reactivateUser(
      adminUserId,
      userId,
      note,
    );
  }

  async forcePasswordReset(adminUserId: string, userId: string) {
    const method = this.forcePasswordReset.name;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        jwtVersion: { increment: 1 },
      },
    });

    this.logger.log(
      `[${method}] Password reset forced for user ${userId} by admin ${adminUserId}`,
    );

    return {
      userId,
      message:
        "JWT version incremented - user will be forced to re-authenticate",
    };
  }

  async getUserActivity(userId: string) {
    const method = this.getUserActivity.name;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [suspensionHistory, storeCount] = await Promise.all([
      this.prisma.userSuspension.findMany({
        where: { userId },
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
      this.prisma.userStore.count({
        where: { userId },
      }),
    ]);

    const activity = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        isSuspended: user.isSuspended,
        suspendedAt: user.suspendedAt,
      },
      storeCount,
      suspensionHistory,
    };

    this.logger.log(`[${method}] Activity retrieved for user ${userId}`);

    return activity;
  }
}
