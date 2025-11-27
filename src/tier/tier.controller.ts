import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiExtraModels } from "@nestjs/swagger";

import { StoreUsageDto } from "./dto/store-usage.dto";
import { TierResponseDto } from "./dto/tier-response.dto";
import { TierService } from "./tier.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  ApiAuth,
  ApiStoreGetAll,
  ApiStoreIdParam,
  ApiResourceErrors,
} from "../common/decorators/api-crud.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Stores / Tiers")
@Controller("stores/:storeId/tiers")
@UseGuards(JwtAuthGuard)
@ApiAuth()
@ApiExtraModels(StandardApiResponse, TierResponseDto, StoreUsageDto)
export class TierController {
  private readonly logger = new Logger(TierController.name);

  constructor(private readonly tierService: TierService) {}

  /**
   * Get tier information for a store
   * @param storeId Store ID
   * @returns StoreTier object
   */
  @Get()
  @ApiStoreGetAll(TierResponseDto, "tier information", {
    summary: "Get tier information for a store (Authenticated)",
    description: "Tier information retrieved successfully",
  })
  @ApiResourceErrors()
  async getStoreTier(
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<TierResponseDto>> {
    const tier = await this.tierService.getStoreTier(storeId);
    return StandardApiResponse.success(
      tier as TierResponseDto,
      "Tier information retrieved successfully",
    );
  }

  /**
   * Get current usage for a store
   * @param storeId Store ID
   * @returns Usage statistics
   */
  @Get("usage")
  @ApiStoreGetAll(StoreUsageDto, "usage statistics", {
    summary: "Get usage statistics for a store (Authenticated)",
    description: "Usage statistics retrieved successfully",
  })
  @ApiStoreIdParam()
  @ApiResourceErrors()
  async getStoreUsage(
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<StoreUsageDto>> {
    const usage = await this.tierService.getStoreUsage(storeId);
    return StandardApiResponse.success(
      usage,
      "Usage statistics retrieved successfully",
    );
  }
}
