import { Injectable, Logger } from "@nestjs/common";
import { AuditLog, AuditAction, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CreateAuditLogDto } from "./dto/create-audit-log.dto";

/**
 * AuditLogService provides immutable audit trail functionality
 * Logs are write-only and cannot be edited or deleted
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create an audit log entry
   * @param dto Audit log data
   * @returns Created AuditLog
   */
  async createLog(dto: CreateAuditLogDto): Promise<AuditLog> {
    const method = this.createLog.name;

    try {
      this.logger.log(
        `[${method}] Creating audit log: ${dto.action} for store ${dto.storeId}`,
      );

      const log = await this.prisma.auditLog.create({
        data: {
          userId: dto.userId,
          storeId: dto.storeId,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          details: dto.details as Prisma.InputJsonValue,
        },
      });

      return log;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to create audit log`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Get audit logs for a store with pagination
   * @param storeId Store ID
   * @param options Query options
   * @returns Paginated audit logs
   */
  async getStoreAuditLogs(
    storeId: string,
    options: {
      page?: number;
      limit?: number;
      action?: AuditAction;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
    const method = this.getStoreAuditLogs.name;
    const {
      page = 1,
      limit = 50,
      action,
      userId,
      startDate,
      endDate,
    } = options;

    const skip = (page - 1) * limit;

    try {
      this.logger.log(
        `[${method}] Fetching audit logs for store ${storeId}, page ${page}`,
      );

      const where: Prisma.AuditLogWhereInput = { storeId };

      if (action) {
        where.action = action;
      }

      if (userId) {
        where.userId = userId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        logs,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `[${method}] Error fetching audit logs for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Helper: Log store setting change
   */
  async logStoreSettingChange(
    storeId: string,
    userId: string,
    details: {
      field: string;
      oldValue: string | number | boolean;
      newValue: string | number | boolean;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      storeId,
      userId,
      action: AuditAction.STORE_SETTING_CHANGED,
      entityType: "StoreSetting",
      entityId: storeId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper: Log menu price change
   */
  async logMenuPriceChange(
    storeId: string,
    userId: string,
    menuItemId: string,
    details: {
      itemName: string;
      oldPrice: string;
      newPrice: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      storeId,
      userId,
      action: AuditAction.MENU_PRICE_CHANGED,
      entityType: "MenuItem",
      entityId: menuItemId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper: Log payment refund
   */
  async logPaymentRefund(
    storeId: string,
    userId: string,
    paymentId: string,
    details: {
      amount: string;
      reason: string;
      orderId: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      storeId,
      userId,
      action: AuditAction.PAYMENT_REFUNDED,
      entityType: "Payment",
      entityId: paymentId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper: Log user role change
   */
  async logUserRoleChange(
    storeId: string,
    userId: string,
    targetUserId: string,
    details: {
      targetUserEmail: string;
      oldRole: string;
      newRole: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      storeId,
      userId,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: "UserStore",
      entityId: targetUserId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper: Log user suspension
   */
  async logUserSuspension(
    storeId: string,
    userId: string,
    targetUserId: string,
    details: {
      targetUserEmail: string;
      reason: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      storeId,
      userId,
      action: AuditAction.USER_SUSPENDED,
      entityType: "User",
      entityId: targetUserId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Helper: Log menu item 86 (out of stock)
   */
  async logItem86(
    storeId: string,
    userId: string,
    menuItemId: string,
    details: {
      itemName: string;
      reason: string;
    },
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.createLog({
      storeId,
      userId,
      action: AuditAction.MENU_ITEM_86D,
      entityType: "MenuItem",
      entityId: menuItemId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Export audit logs to CSV format
   * @param storeId Store ID to export logs for
   * @param filters Optional filters for the export
   * @returns CSV string
   */
  async exportToCSV(
    storeId: string,
    filters: {
      action?: AuditAction;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<string> {
    const method = this.exportToCSV.name;

    try {
      this.logger.log(
        `[${method}] Exporting audit logs to CSV for store ${storeId}`,
      );

      // Get all matching logs (no pagination for export, but limit to 100K records)
      const result = await this.getStoreAuditLogs(storeId, {
        ...filters,
        page: 1,
        limit: 100000,
      });

      // Generate CSV header
      const csvHeader =
        "Timestamp,User ID,Action,Entity Type,Entity ID,Details,IP Address,User Agent\n";

      // Generate CSV rows
      const csvRows = result.logs
        .map((log) => {
          return [
            log.createdAt.toISOString(),
            log.userId ?? "SYSTEM",
            log.action,
            log.entityType,
            log.entityId ?? "N/A",
            JSON.stringify(log.details),
            log.ipAddress ?? "N/A",
            log.userAgent ?? "N/A",
          ]
            .map((field) => `"${String(field).replace(/"/g, '""')}"`)
            .join(",");
        })
        .join("\n");

      this.logger.log(
        `[${method}] Exported ${result.logs.length} audit logs for store ${storeId}`,
      );

      return csvHeader + csvRows;
    } catch (error) {
      this.logger.error(
        `[${method}] Error exporting audit logs for store ${storeId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
