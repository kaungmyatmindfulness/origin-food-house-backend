import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, SuspensionStatus } from "@prisma/client";

import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class SuspensionService {
  private readonly logger = new Logger(SuspensionService.name);

  constructor(private prisma: PrismaService) {}

  async suspendStore(adminUserId: string, storeId: string, reason: string) {
    const method = this.suspendStore.name;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { subscription: true },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    if (store.subscription?.status === "SUSPENDED") {
      throw new BadRequestException("Store is already suspended");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.storeSuspension.create({
        data: {
          storeId,
          suspendedBy: adminUserId,
          reason,
          status: SuspensionStatus.SUSPENDED,
        },
      });

      if (store.subscription) {
        await tx.subscription.update({
          where: { id: store.subscription.id },
          data: {
            status: "SUSPENDED",
          },
        });
      }
    });

    this.logger.log(
      `[${method}] Store ${storeId} suspended by admin ${adminUserId}`,
    );

    return await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { subscription: true, information: true },
    });
  }

  async banStore(adminUserId: string, storeId: string, reason: string) {
    const method = this.banStore.name;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { subscription: true },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    if (store.suspensionStatus === SuspensionStatus.BANNED) {
      throw new BadRequestException("Store is already banned");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.storeSuspension.create({
        data: {
          storeId,
          suspendedBy: adminUserId,
          reason,
          status: SuspensionStatus.BANNED,
        },
      });

      await tx.store.update({
        where: { id: storeId },
        data: {
          suspensionStatus: SuspensionStatus.BANNED,
          suspendedAt: new Date(),
          suspensionReason: reason,
        },
      });

      if (store.subscription) {
        await tx.subscription.update({
          where: { id: store.subscription.id },
          data: {
            status: "SUSPENDED",
          },
        });
      }
    });

    this.logger.log(
      `[${method}] Store ${storeId} banned by admin ${adminUserId}`,
    );

    return await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { subscription: true, information: true },
    });
  }

  async reactivateStore(adminUserId: string, storeId: string, note?: string) {
    const method = this.reactivateStore.name;

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { subscription: true },
    });

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    if (store.suspensionStatus === SuspensionStatus.ACTIVE) {
      throw new BadRequestException("Store is not suspended or banned");
    }

    const lastSuspension = await this.prisma.storeSuspension.findFirst({
      where: { storeId, status: { in: ["SUSPENDED", "BANNED"] } },
      orderBy: { suspendedAt: "desc" },
    });

    if (!lastSuspension) {
      throw new NotFoundException("No active suspension found for this store");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.storeSuspension.update({
        where: { id: lastSuspension.id },
        data: {
          status: SuspensionStatus.ACTIVE,
          reactivatedBy: adminUserId,
          reactivatedAt: new Date(),
          reactivationNotes: note,
        },
      });

      await tx.store.update({
        where: { id: storeId },
        data: {
          suspensionStatus: SuspensionStatus.ACTIVE,
          suspendedAt: null,
          suspensionReason: null,
        },
      });

      if (store.subscription) {
        await tx.subscription.update({
          where: { id: store.subscription.id },
          data: {
            status: "ACTIVE",
          },
        });
      }
    });

    this.logger.log(
      `[${method}] Store ${storeId} reactivated by admin ${adminUserId}`,
    );

    return await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { subscription: true, information: true },
    });
  }

  async suspendUser(adminUserId: string, userId: string, reason: string) {
    const method = this.suspendUser.name;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isSuspended) {
      throw new BadRequestException("User is already suspended");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSuspension.create({
        data: {
          userId,
          suspendedBy: adminUserId,
          reason,
          status: SuspensionStatus.SUSPENDED,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedReason: reason,
          jwtVersion: { increment: 1 },
        },
      });
    });

    this.logger.log(
      `[${method}] User ${userId} suspended by admin ${adminUserId}`,
    );

    return await this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async banUser(adminUserId: string, userId: string, reason: string) {
    const method = this.banUser.name;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSuspension.create({
        data: {
          userId,
          suspendedBy: adminUserId,
          reason,
          status: SuspensionStatus.BANNED,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspendedReason: reason,
          jwtVersion: { increment: 1 },
        },
      });
    });

    this.logger.log(
      `[${method}] User ${userId} banned by admin ${adminUserId}`,
    );

    return await this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async reactivateUser(adminUserId: string, userId: string, note?: string) {
    const method = this.reactivateUser.name;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.isSuspended) {
      throw new BadRequestException("User is not suspended");
    }

    const lastSuspension = await this.prisma.userSuspension.findFirst({
      where: { userId, status: { in: ["SUSPENDED", "BANNED"] } },
      orderBy: { suspendedAt: "desc" },
    });

    if (!lastSuspension) {
      throw new NotFoundException("No active suspension found for this user");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userSuspension.update({
        where: { id: lastSuspension.id },
        data: {
          status: SuspensionStatus.ACTIVE,
          reactivatedBy: adminUserId,
          reactivatedAt: new Date(),
          reactivationNotes: note,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          isSuspended: false,
          suspendedAt: null,
          suspendedReason: null,
        },
      });
    });

    this.logger.log(
      `[${method}] User ${userId} reactivated by admin ${adminUserId}`,
    );

    return await this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
