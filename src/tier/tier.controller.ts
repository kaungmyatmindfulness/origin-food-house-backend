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
} from "@nestjs/swagger";

import { TierService } from "./tier.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Stores / Tiers")
@Controller("stores/:storeId/tiers")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
  async getStoreTier(
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ) {
    const tier = await this.tierService.getStoreTier(storeId);
    return {
      status: "success" as const,
      data: tier,
      message: "Tier information retrieved successfully",
      errors: null,
    };
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
  async getStoreUsage(
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ) {
    const usage = await this.tierService.getStoreUsage(storeId);
    return {
      status: "success" as const,
      data: usage,
      message: "Usage statistics retrieved successfully",
      errors: null,
    };
  }
}
