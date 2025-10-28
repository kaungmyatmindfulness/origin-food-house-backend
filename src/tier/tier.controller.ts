import { Controller, Get, Param, UseGuards, Logger } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

import { TierService } from "./tier.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Tier")
@Controller("tier")
export class TierController {
  private readonly logger = new Logger(TierController.name);

  constructor(private readonly tierService: TierService) {}

  /**
   * Get tier information for a store
   * @param storeId Store ID
   * @returns StoreTier object
   */
  @Get(":storeId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getStoreTier(@Param("storeId") storeId: string) {
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
  @Get(":storeId/usage")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getStoreUsage(@Param("storeId") storeId: string) {
    const usage = await this.tierService.getStoreUsage(storeId);
    return {
      status: "success" as const,
      data: usage,
      message: "Usage statistics retrieved successfully",
      errors: null,
    };
  }
}
