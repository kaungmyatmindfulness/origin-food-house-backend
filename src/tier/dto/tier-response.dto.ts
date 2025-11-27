import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  Tier,
  SubscriptionStatus,
  BillingCycle,
} from "src/generated/prisma/client";

export class TierResponseDto {
  @ApiProperty({ description: "Subscription ID", example: "0194ca3b-..." })
  id: string;

  @ApiProperty({ description: "Store ID", example: "0194ca3b-..." })
  storeId: string;

  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    description: "Current tier",
    example: "STANDARD",
  })
  tier: Tier;

  @ApiPropertyOptional({
    description: "External subscription ID",
    example: "sub_123",
  })
  subscriptionId?: string;

  @ApiProperty({
    enum: ["ACTIVE", "CANCELLED", "PAST_DUE", "TRIAL", "SUSPENDED"],
    description: "Subscription status",
    example: "ACTIVE",
  })
  subscriptionStatus: SubscriptionStatus;

  @ApiProperty({
    enum: ["MONTHLY", "YEARLY"],
    description: "Billing cycle",
    example: "MONTHLY",
  })
  billingCycle: BillingCycle;

  @ApiPropertyOptional({
    description: "Current period start date",
    example: "2025-01-01T00:00:00.000Z",
  })
  currentPeriodStart?: Date;

  @ApiPropertyOptional({
    description: "Current period end date",
    example: "2025-02-01T00:00:00.000Z",
  })
  currentPeriodEnd?: Date;

  @ApiPropertyOptional({
    description: "Trial end date",
    example: "2025-01-15T00:00:00.000Z",
  })
  trialEndsAt?: Date;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

export class TierUsageResponseDto {
  @ApiProperty({ description: "Number of tables", example: 5 })
  tables: number;

  @ApiProperty({ description: "Number of menu items", example: 25 })
  menuItems: number;

  @ApiProperty({ description: "Number of staff members", example: 3 })
  staff: number;

  @ApiProperty({ description: "Orders this month", example: 150 })
  ordersThisMonth: number;
}

export class TierLimitCheckResponseDto {
  @ApiProperty({ description: "Whether the action is allowed", example: true })
  allowed: boolean;

  @ApiProperty({ description: "Current usage count", example: 5 })
  currentUsage: number;

  @ApiProperty({ description: "Maximum limit for the tier", example: 10 })
  limit: number;

  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    description: "Current tier",
    example: "STANDARD",
  })
  tier: Tier;

  @ApiProperty({
    description: "Usage percentage (calculated)",
    example: 50,
  })
  usagePercentage: number;
}
