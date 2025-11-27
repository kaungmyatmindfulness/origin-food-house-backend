import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiExtraModels,
} from "@nestjs/swagger";

import { StoreUsageDto } from "./dto/store-usage.dto";
import { TierResponseDto } from "./dto/tier-response.dto";
import { TierService } from "./tier.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Stores / Tiers")
@Controller("stores/:storeId/tiers")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
  @ApiOperation({ summary: "Get tier information for a store (Authenticated)" })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(TierResponseDto, {
    description: "Tier information retrieved successfully",
  })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  @ApiNotFoundResponse({ description: "Store not found" })
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
  @ApiOperation({ summary: "Get usage statistics for a store (Authenticated)" })
  @ApiParam({
    name: "storeId",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(StoreUsageDto, {
    description: "Usage statistics retrieved successfully",
  })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  @ApiNotFoundResponse({ description: "Store not found" })
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
