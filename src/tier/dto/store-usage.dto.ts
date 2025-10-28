import { ApiProperty } from "@nestjs/swagger";
import { Tier } from "@prisma/client";

/**
 * DTO representing usage of a single resource with its limit
 */
export class ResourceUsageDto {
  @ApiProperty({ example: 15, description: "Current usage count" })
  current: number;

  @ApiProperty({ example: 20, description: "Maximum allowed by tier" })
  limit: number;

  @ApiProperty({
    example: 75,
    description: "Usage percentage (calculated)",
  })
  get percentage(): number {
    if (this.limit === Infinity || this.limit === 0) {
      return 0;
    }
    return Math.round((this.current / this.limit) * 100);
  }
}

/**
 * DTO representing all resource usage for a store
 */
export class UsageBreakdownDto {
  @ApiProperty({ type: () => ResourceUsageDto })
  tables: ResourceUsageDto;

  @ApiProperty({ type: () => ResourceUsageDto })
  menuItems: ResourceUsageDto;

  @ApiProperty({ type: () => ResourceUsageDto })
  staff: ResourceUsageDto;

  @ApiProperty({ type: () => ResourceUsageDto })
  monthlyOrders: ResourceUsageDto;
}

/**
 * DTO representing feature access flags
 */
export class FeatureAccessDto {
  @ApiProperty({
    example: true,
    description: "Access to Kitchen Display System",
  })
  kds: boolean;

  @ApiProperty({ example: false, description: "Access to Loyalty Program" })
  loyalty: boolean;

  @ApiProperty({ example: false, description: "Access to Advanced Reports" })
  advancedReports: boolean;
}

/**
 * Complete store usage dashboard DTO
 */
export class StoreUsageDto {
  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    example: "STANDARD",
  })
  tier: Tier;

  @ApiProperty({ type: () => UsageBreakdownDto })
  usage: UsageBreakdownDto;

  @ApiProperty({ type: () => FeatureAccessDto })
  features: FeatureAccessDto;
}
