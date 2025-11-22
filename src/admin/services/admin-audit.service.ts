import { Injectable, Logger } from "@nestjs/common";

import { AdminActionType, Prisma } from "src/generated/prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

interface AdminActionLogData {
  adminUserId: string;
  actionType: AdminActionType;
  targetType: string;
  targetId: string | null;
  details: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(data: AdminActionLogData): Promise<void> {
    const method = this.log.name;

    try {
      await this.prisma.adminAction.create({
        data: {
          adminUserId: data.adminUserId,
          actionType: data.actionType,
          targetType: data.targetType,
          targetId: data.targetId,
          details: data.details
            ? (JSON.parse(data.details) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      this.logger.log(
        `[${method}] Admin action logged: ${data.actionType} on ${data.targetType}:${data.targetId} by admin ${data.adminUserId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to log admin action`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getAdminActions(filters: {
    adminUserId?: string;
    actionType?: AdminActionType;
    targetType?: string;
    targetId?: string;
    limit?: number;
  }) {
    const method = this.getAdminActions.name;

    try {
      const actions = await this.prisma.adminAction.findMany({
        where: {
          adminUserId: filters.adminUserId,
          actionType: filters.actionType,
          targetType: filters.targetType,
          targetId: filters.targetId,
        },
        include: {
          adminUser: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
        orderBy: { timestamp: "desc" },
        take: filters.limit ?? 100,
      });

      this.logger.log(`[${method}] Retrieved ${actions.length} admin actions`);

      return actions;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to retrieve admin actions`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
