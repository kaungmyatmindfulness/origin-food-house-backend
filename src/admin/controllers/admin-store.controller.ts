import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { SubscriptionTier } from "src/generated/prisma/client";

import { BanStoreDto } from "../dto/ban-store.dto";
import { DowngradeTierDto } from "../dto/downgrade-tier.dto";
import { ListStoresDto } from "../dto/list-stores.dto";
import { ReactivateStoreDto } from "../dto/reactivate-store.dto";
import { SuspendStoreDto } from "../dto/suspend-store.dto";
import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { AdminAuditInterceptor } from "../interceptors/admin-audit.interceptor";
import { AdminStoreService } from "../services/admin-store.service";

@ApiTags("Admin - Store Management")
@Controller("admin/stores")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
@ApiBearerAuth()
export class AdminStoreController {
  constructor(private readonly adminStoreService: AdminStoreService) {}

  @Get()
  @ApiOperation({
    summary: "List all stores",
    description: "Get paginated list of all stores with filters",
  })
  @ApiOkResponse({ description: "Stores retrieved successfully" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async listStores(@Query() query: ListStoresDto) {
    return await this.adminStoreService.listStores(query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get store detail",
    description: "Get detailed information for a specific store",
  })
  @ApiOkResponse({ description: "Store detail retrieved successfully" })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async getStoreDetail(@Param("id") id: string) {
    return await this.adminStoreService.getStoreDetail(id);
  }

  @Post(":id/suspend")
  @ApiOperation({
    summary: "Suspend store",
    description: "Temporarily suspend a store and its operations",
  })
  @ApiOkResponse({ description: "Store suspended successfully" })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiBadRequestResponse({ description: "Store is already suspended" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async suspendStore(
    @Param("id") id: string,
    @Body() dto: SuspendStoreDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.suspendStore(adminId, id, dto.reason);
  }

  @Post(":id/ban")
  @ApiOperation({
    summary: "Ban store",
    description: "Permanently ban a store from the platform",
  })
  @ApiOkResponse({ description: "Store banned successfully" })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiBadRequestResponse({ description: "Store is already banned" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async banStore(
    @Param("id") id: string,
    @Body() dto: BanStoreDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.banStore(adminId, id, dto.reason);
  }

  @Post(":id/reactivate")
  @ApiOperation({
    summary: "Reactivate store",
    description: "Reactivate a suspended or banned store",
  })
  @ApiOkResponse({ description: "Store reactivated successfully" })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiBadRequestResponse({ description: "Store is not suspended or banned" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async reactivateStore(
    @Param("id") id: string,
    @Body() dto: ReactivateStoreDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.reactivateStore(adminId, id, dto.note);
  }

  @Post(":id/downgrade")
  @ApiOperation({
    summary: "Downgrade store tier",
    description: "Force downgrade a store to a lower tier",
  })
  @ApiOkResponse({ description: "Store tier downgraded successfully" })
  @ApiNotFoundResponse({ description: "Store or target tier not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async downgradeTier(
    @Param("id") id: string,
    @Body() dto: DowngradeTierDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.downgradeTier(
      adminId,
      id,
      dto.targetTierId as SubscriptionTier,
      dto.reason,
    );
  }

  @Get(":id/analytics")
  @ApiOperation({
    summary: "Get store analytics",
    description: "Get analytics and statistics for a specific store",
  })
  @ApiOkResponse({ description: "Store analytics retrieved successfully" })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async getStoreAnalytics(@Param("id") id: string) {
    return await this.adminStoreService.getStoreAnalytics(id);
  }
}
