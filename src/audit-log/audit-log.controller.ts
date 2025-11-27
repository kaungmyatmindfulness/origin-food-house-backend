import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Logger,
  Header,
  Res,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiQuery,
  ApiOperation,
  ApiExtraModels,
  ApiProduces,
} from "@nestjs/swagger";
import { Response } from "express";

import { AuditAction, Role } from "src/generated/prisma/client";

import { AuditLogService } from "./audit-log.service";
import {
  AuditLogEntryDto,
  AuditLogPaginatedResponseDto,
} from "./dto/audit-log-response.dto";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApiAuth,
  ApiStoreGetAll,
  ApiStoreIdParam,
  ApiResourceErrors,
} from "../common/decorators/api-crud.decorator";
import { GetUser } from "../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Stores / Audit Logs")
@Controller("stores/:storeId/audit-logs")
@UseGuards(JwtAuthGuard)
@ApiAuth()
@ApiExtraModels(
  StandardApiResponse,
  AuditLogEntryDto,
  AuditLogPaginatedResponseDto,
)
export class AuditLogController {
  private readonly logger = new Logger(AuditLogController.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get audit logs for a store (Owner-only)
   * @param currentUserId User ID from JWT (requesting user)
   * @param storeId Store ID
   * @param page Page number
   * @param limit Items per page
   * @param action Filter by action type
   * @param userId Filter by user ID
   * @returns Paginated audit logs
   */
  @Get()
  @ApiStoreGetAll(AuditLogPaginatedResponseDto, "audit logs", {
    summary: "Get audit logs for a store (OWNER only)",
    description: "Audit logs retrieved successfully",
  })
  @ApiResourceErrors()
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (1-indexed)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (max 100)",
  })
  @ApiQuery({
    name: "action",
    required: false,
    enum: AuditAction,
    description: "Filter by action type",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    type: String,
    description: "Filter by user ID",
  })
  async getStoreAuditLogs(
    @GetUser("sub") currentUserId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("action") action?: AuditAction,
    @Query("userId") userId?: string,
  ): Promise<StandardApiResponse<AuditLogPaginatedResponseDto>> {
    const method = this.getStoreAuditLogs.name;

    // RBAC: Only store owners can view audit logs
    this.logger.log(
      `[${method}] User ${currentUserId} requesting audit logs for store ${storeId}`,
    );
    await this.authService.checkStorePermission(currentUserId, storeId, [
      Role.OWNER,
    ]);
    const logs = await this.auditLogService.getStoreAuditLogs(storeId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
      userId,
    });

    return StandardApiResponse.success(
      logs as AuditLogPaginatedResponseDto,
      "Audit logs retrieved successfully",
    );
  }

  /**
   * Export audit logs to CSV (Owner-only)
   * @param currentUserId User ID from JWT (requesting user)
   * @param storeId Store ID
   * @param action Filter by action type
   * @param userId Filter by user ID
   * @param startDate Filter by start date (ISO 8601)
   * @param endDate Filter by end date (ISO 8601)
   * @param res Response object for streaming CSV
   * @returns CSV file download
   */
  @Get("export")
  @ApiOperation({
    summary: "Export audit logs to CSV (OWNER only)",
    description: "Downloads audit logs as a CSV file with optional filters",
  })
  @ApiStoreIdParam()
  @ApiResourceErrors()
  @Header("Content-Type", "text/csv")
  @ApiProduces("text/csv")
  @ApiQuery({
    name: "action",
    required: false,
    enum: AuditAction,
    description: "Filter by action type",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    type: String,
    description: "Filter by user ID",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Start date filter (ISO 8601 format)",
    example: "2025-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "End date filter (ISO 8601 format)",
    example: "2025-12-31T23:59:59.999Z",
  })
  async exportAuditLogs(
    @GetUser("sub") currentUserId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Query("action") action?: AuditAction,
    @Query("userId") userId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Res() res?: Response,
  ) {
    const method = this.exportAuditLogs.name;

    // RBAC: Only store owners can export audit logs
    this.logger.log(
      `[${method}] User ${currentUserId} exporting audit logs for store ${storeId}`,
    );
    await this.authService.checkStorePermission(currentUserId, storeId, [
      Role.OWNER,
    ]);
    const csv = await this.auditLogService.exportToCSV(storeId, {
      action,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Set filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    res?.setHeader(
      "Content-Disposition",
      `attachment; filename="audit-logs-${storeId}-${timestamp}.csv"`,
    );

    return res?.send(csv);
  }
}
