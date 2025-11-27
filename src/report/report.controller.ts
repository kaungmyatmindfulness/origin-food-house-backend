import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  Req,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiQuery } from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

import { ReportService } from "./report.service";
import { AuthService } from "../auth/auth.service";
import { RequestWithUser } from "../auth/types";
import { OrderStatusReportDto } from "./dto/order-status-report.dto";
import { PaymentBreakdownDto } from "./dto/payment-breakdown.dto";
import { PopularItemsDto } from "./dto/popular-items.dto";
import { SalesSummaryDto } from "./dto/sales-summary.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApiAuth,
  ApiAuthWithRoles,
  ApiStoreIdParam,
  ApiResourceErrors,
} from "../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

/**
 * Controller for analytics and reporting endpoints
 * Only accessible by OWNER and ADMIN roles
 */
@ApiTags("Stores / Reports")
@Controller("stores/:storeId/reports")
@UseGuards(JwtAuthGuard)
@ApiAuth()
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Get sales summary report
   */
  @Get("sales-summary")
  @ApiAuthWithRoles()
  @ApiStoreIdParam()
  @ApiQuery({
    name: "startDate",
    required: true,
    description: "Start date (ISO 8601)",
    type: String,
    example: "2025-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endDate",
    required: true,
    description: "End date (ISO 8601)",
    type: String,
    example: "2025-01-31T23:59:59.999Z",
  })
  @ApiSuccessResponse(SalesSummaryDto, "Sales summary retrieved successfully")
  @ApiResourceErrors()
  async getSalesSummary(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Query("startDate") startDateStr: string,
    @Query("endDate") endDateStr: string,
  ): Promise<StandardApiResponse<SalesSummaryDto>> {
    const userId = req.user.sub;

    // Check permission - OWNER and ADMIN only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Validate and parse dates
    const { startDate, endDate } = this.parseDateRange(
      startDateStr,
      endDateStr,
    );

    const summary = await this.reportService.getSalesSummary(
      storeId,
      startDate,
      endDate,
    );
    return StandardApiResponse.success(summary);
  }

  /**
   * Get payment method breakdown report
   */
  @Get("payment-breakdown")
  @ApiAuthWithRoles()
  @ApiStoreIdParam()
  @ApiQuery({
    name: "startDate",
    required: true,
    description: "Start date (ISO 8601)",
    type: String,
    example: "2025-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endDate",
    required: true,
    description: "End date (ISO 8601)",
    type: String,
    example: "2025-01-31T23:59:59.999Z",
  })
  @ApiSuccessResponse(
    PaymentBreakdownDto,
    "Payment breakdown retrieved successfully",
  )
  @ApiResourceErrors()
  async getPaymentBreakdown(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Query("startDate") startDateStr: string,
    @Query("endDate") endDateStr: string,
  ): Promise<StandardApiResponse<PaymentBreakdownDto>> {
    const userId = req.user.sub;

    // Check permission - OWNER and ADMIN only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Validate and parse dates
    const { startDate, endDate } = this.parseDateRange(
      startDateStr,
      endDateStr,
    );

    const breakdown = await this.reportService.getPaymentBreakdown(
      storeId,
      startDate,
      endDate,
    );
    return StandardApiResponse.success(breakdown);
  }

  /**
   * Get popular menu items report
   */
  @Get("popular-items")
  @ApiAuthWithRoles()
  @ApiStoreIdParam()
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Number of items to return (default 10)",
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: "startDate",
    required: true,
    description: "Start date (ISO 8601)",
    type: String,
    example: "2025-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endDate",
    required: true,
    description: "End date (ISO 8601)",
    type: String,
    example: "2025-01-31T23:59:59.999Z",
  })
  @ApiSuccessResponse(PopularItemsDto, "Popular items retrieved successfully")
  @ApiResourceErrors()
  async getPopularItems(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Query("limit") limitStr?: string,
    @Query("startDate") startDateStr?: string,
    @Query("endDate") endDateStr?: string,
  ): Promise<StandardApiResponse<PopularItemsDto>> {
    const userId = req.user.sub;

    // Check permission - OWNER and ADMIN only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Parse limit
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException("Limit must be between 1 and 100");
    }

    // Validate and parse dates
    const { startDate, endDate } = this.parseDateRange(
      startDateStr ?? "",
      endDateStr ?? "",
    );

    const popularItems = await this.reportService.getPopularItems(
      storeId,
      limit,
      startDate,
      endDate,
    );
    return StandardApiResponse.success(popularItems);
  }

  /**
   * Get order status distribution report
   */
  @Get("order-status")
  @ApiAuthWithRoles()
  @ApiStoreIdParam()
  @ApiQuery({
    name: "startDate",
    required: true,
    description: "Start date (ISO 8601)",
    type: String,
    example: "2025-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endDate",
    required: true,
    description: "End date (ISO 8601)",
    type: String,
    example: "2025-01-31T23:59:59.999Z",
  })
  @ApiSuccessResponse(
    OrderStatusReportDto,
    "Order status report retrieved successfully",
  )
  @ApiResourceErrors()
  async getOrderStatusReport(
    @Req() req: RequestWithUser,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Query("startDate") startDateStr: string,
    @Query("endDate") endDateStr: string,
  ): Promise<StandardApiResponse<OrderStatusReportDto>> {
    const userId = req.user.sub;

    // Check permission - OWNER and ADMIN only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Validate and parse dates
    const { startDate, endDate } = this.parseDateRange(
      startDateStr,
      endDateStr,
    );

    const statusReport = await this.reportService.getOrderStatusReport(
      storeId,
      startDate,
      endDate,
    );
    return StandardApiResponse.success(statusReport);
  }

  /**
   * Helper method to parse and validate date range
   * @private
   */
  private parseDateRange(
    startDateStr: string,
    endDateStr: string,
  ): { startDate: Date; endDate: Date } {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException("Start date and end date are required");
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime())) {
      throw new BadRequestException("Invalid start date format");
    }

    if (isNaN(endDate.getTime())) {
      throw new BadRequestException("Invalid end date format");
    }

    if (startDate > endDate) {
      throw new BadRequestException("Start date must be before end date");
    }

    return { startDate, endDate };
  }
}
