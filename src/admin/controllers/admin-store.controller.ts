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
import { ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import {
  ApiAuthWithRoles,
  ApiGetAll,
  ApiGetOneAuth,
  ApiAction,
  ApiResourceErrors,
} from "src/common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
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

// Placeholder response class for untyped responses
class StoreResponseDto {}
class StoreDetailResponseDto {}
class StoreActionResponseDto {}
class StoreAnalyticsResponseDto {}

@ApiTags("Admin - Store Management")
@Controller("admin/stores")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminStoreController {
  constructor(private readonly adminStoreService: AdminStoreService) {}

  @Get()
  @ApiAuthWithRoles()
  @ApiGetAll(StoreResponseDto, "stores", {
    summary: "List all stores",
    description: "Stores retrieved successfully",
  })
  async listStores(@Query() query: ListStoresDto) {
    return await this.adminStoreService.listStores(query);
  }

  @Get(":id")
  @ApiGetOneAuth(StoreDetailResponseDto, "store", {
    summary: "Get store detail",
    description: "Store detail retrieved successfully",
  })
  async getStoreDetail(@Param("id") id: string) {
    return await this.adminStoreService.getStoreDetail(id);
  }

  @Post(":id/suspend")
  @ApiAction(StoreActionResponseDto, "suspend", "store", {
    summary: "Suspend store",
    description: "Store suspended successfully",
  })
  async suspendStore(
    @Param("id") id: string,
    @Body() dto: SuspendStoreDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.suspendStore(adminId, id, dto.reason);
  }

  @Post(":id/ban")
  @ApiAction(StoreActionResponseDto, "ban", "store", {
    summary: "Ban store",
    description: "Store banned successfully",
  })
  async banStore(
    @Param("id") id: string,
    @Body() dto: BanStoreDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.banStore(adminId, id, dto.reason);
  }

  @Post(":id/reactivate")
  @ApiAction(StoreActionResponseDto, "reactivate", "store", {
    summary: "Reactivate store",
    description: "Store reactivated successfully",
  })
  async reactivateStore(
    @Param("id") id: string,
    @Body() dto: ReactivateStoreDto,
    @GetUser("adminId") adminId: string,
  ) {
    return await this.adminStoreService.reactivateStore(adminId, id, dto.note);
  }

  @Post(":id/downgrade")
  @ApiAction(StoreActionResponseDto, "downgrade tier for", "store", {
    summary: "Downgrade store tier",
    description: "Store tier downgraded successfully",
  })
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
  @ApiAuthWithRoles()
  @ApiSuccessResponse(
    StoreAnalyticsResponseDto,
    "Store analytics retrieved successfully",
  )
  @ApiResourceErrors()
  async getStoreAnalytics(@Param("id") id: string) {
    return await this.adminStoreService.getStoreAnalytics(id);
  }
}
