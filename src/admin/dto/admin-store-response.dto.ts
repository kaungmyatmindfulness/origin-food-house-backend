import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  SubscriptionStatus,
  SubscriptionTier,
  BillingCycle,
} from "src/generated/prisma/client";

/**
 * Store information nested response
 */
export class AdminStoreInformationDto {
  @ApiProperty({ description: "Store information ID" })
  id: string;

  @ApiProperty({ description: "Store name" })
  name: string;

  @ApiPropertyOptional({
    type: String,
    description: "Store description",
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Store phone number",
    nullable: true,
  })
  phone: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Store email",
    nullable: true,
  })
  email: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Store address",
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Store logo path",
    nullable: true,
  })
  logoPath: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Store cover photo path",
    nullable: true,
  })
  coverPhotoPath: string | null;
}

/**
 * Store subscription nested response
 */
export class AdminStoreSubscriptionDto {
  @ApiProperty({ description: "Subscription ID" })
  id: string;

  @ApiProperty({ enum: SubscriptionTier, description: "Subscription tier" })
  tier: SubscriptionTier;

  @ApiProperty({ enum: SubscriptionStatus, description: "Subscription status" })
  status: SubscriptionStatus;

  @ApiProperty({ enum: BillingCycle, description: "Billing cycle" })
  billingCycle: BillingCycle;

  @ApiPropertyOptional({
    type: Date,
    description: "Current period start date",
    nullable: true,
  })
  currentPeriodStart: Date | null;

  @ApiPropertyOptional({
    type: Date,
    description: "Current period end date",
    nullable: true,
  })
  currentPeriodEnd: Date | null;

  @ApiPropertyOptional({
    type: Date,
    description: "Trial end date",
    nullable: true,
  })
  trialEndsAt: Date | null;
}

/**
 * Store tier nested response
 */
export class AdminStoreTierDto {
  @ApiProperty({ description: "Tier ID" })
  id: string;

  @ApiProperty({ enum: SubscriptionTier, description: "Current tier" })
  tier: SubscriptionTier;
}

/**
 * Store counts nested response
 */
export class AdminStoreCountsDto {
  @ApiProperty({ description: "Number of users in store" })
  userStores: number;

  @ApiProperty({ description: "Number of orders" })
  orders: number;

  @ApiPropertyOptional({ description: "Number of tables" })
  tables?: number;

  @ApiPropertyOptional({ description: "Number of menu items" })
  menuItems?: number;

  @ApiPropertyOptional({ description: "Number of categories" })
  categories?: number;
}

/**
 * Store list item response (for listing stores)
 */
export class StoreResponseDto {
  @ApiProperty({ description: "Store ID" })
  id: string;

  @ApiProperty({ description: "Store slug" })
  slug: string;

  @ApiProperty({ description: "Store suspended status" })
  isSuspended: boolean;

  @ApiProperty({ description: "Store banned status" })
  isBanned: boolean;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Store information",
    type: AdminStoreInformationDto,
  })
  information: AdminStoreInformationDto | null;

  @ApiPropertyOptional({
    description: "Store subscription",
    type: AdminStoreSubscriptionDto,
  })
  subscription: AdminStoreSubscriptionDto | null;

  @ApiPropertyOptional({ description: "Store tier", type: AdminStoreTierDto })
  tier: AdminStoreTierDto | null;

  @ApiProperty({ description: "Store counts", type: AdminStoreCountsDto })
  _count: AdminStoreCountsDto;
}

/**
 * Store user nested response (for store detail)
 */
export class AdminStoreUserDto {
  @ApiProperty({ description: "User ID" })
  id: string;

  @ApiProperty({ description: "User email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "User name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({ description: "User suspended status" })
  isSuspended: boolean;
}

/**
 * Store user store relation nested response
 */
export class AdminStoreUserStoreDto {
  @ApiProperty({ description: "User store relation ID" })
  id: string;

  @ApiProperty({ description: "User role in store" })
  role: string;

  @ApiProperty({ description: "User details", type: AdminStoreUserDto })
  user: AdminStoreUserDto;
}

/**
 * Store setting nested response
 */
export class AdminStoreSettingDto {
  @ApiProperty({ description: "Setting ID" })
  id: string;

  @ApiProperty({ description: "Currency code" })
  currency: string;

  @ApiPropertyOptional({
    type: String,
    description: "VAT rate",
    nullable: true,
  })
  vatRate: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Service charge rate",
    nullable: true,
  })
  serviceChargeRate: string | null;

  @ApiProperty({ description: "Loyalty enabled" })
  loyaltyEnabled: boolean;
}

/**
 * Store detail response (for single store)
 */
export class StoreDetailResponseDto {
  @ApiProperty({ description: "Store ID" })
  id: string;

  @ApiProperty({ description: "Store slug" })
  slug: string;

  @ApiProperty({ description: "Store suspended status" })
  isSuspended: boolean;

  @ApiProperty({ description: "Store banned status" })
  isBanned: boolean;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Store information",
    type: AdminStoreInformationDto,
  })
  information: AdminStoreInformationDto | null;

  @ApiPropertyOptional({
    description: "Store setting",
    type: AdminStoreSettingDto,
  })
  setting: AdminStoreSettingDto | null;

  @ApiPropertyOptional({
    description: "Store subscription",
    type: AdminStoreSubscriptionDto,
  })
  subscription: AdminStoreSubscriptionDto | null;

  @ApiPropertyOptional({ description: "Store tier", type: AdminStoreTierDto })
  tier: AdminStoreTierDto | null;

  @ApiProperty({
    description: "Store users",
    type: [AdminStoreUserStoreDto],
  })
  userStores: AdminStoreUserStoreDto[];

  @ApiProperty({ description: "Store counts", type: AdminStoreCountsDto })
  _count: AdminStoreCountsDto;
}

/**
 * Store action response (for suspend, ban, reactivate)
 */
export class StoreActionResponseDto {
  @ApiProperty({ description: "Store ID" })
  id: string;

  @ApiProperty({ description: "Store slug" })
  slug: string;

  @ApiProperty({ description: "Store suspended status" })
  isSuspended: boolean;

  @ApiProperty({ description: "Store banned status" })
  isBanned: boolean;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * Admin info nested in suspension history
 */
export class AdminInfoDto {
  @ApiProperty({ description: "Admin ID" })
  id: string;

  @ApiProperty({ description: "Admin email" })
  email: string;

  @ApiPropertyOptional({
    type: String,
    description: "Admin name",
    nullable: true,
  })
  name: string | null;
}

/**
 * Suspension history item
 */
export class SuspensionHistoryItemDto {
  @ApiProperty({ description: "Suspension ID" })
  id: string;

  @ApiProperty({ description: "Suspension reason" })
  reason: string;

  @ApiProperty({ description: "Suspended at timestamp" })
  suspendedAt: Date;

  @ApiPropertyOptional({
    type: Date,
    description: "Reactivated at timestamp",
    nullable: true,
  })
  reactivatedAt: Date | null;

  @ApiPropertyOptional({
    description: "Admin who suspended",
    type: AdminInfoDto,
  })
  suspendedByAdmin: AdminInfoDto | null;

  @ApiPropertyOptional({
    description: "Admin who reactivated",
    type: AdminInfoDto,
  })
  reactivatedByAdmin: AdminInfoDto | null;
}

/**
 * Store analytics response
 */
export class StoreAnalyticsResponseDto {
  @ApiProperty({ description: "Total number of orders" })
  totalOrders: number;

  @ApiProperty({ description: "Total revenue" })
  totalRevenue: number;

  @ApiProperty({ description: "Number of active users" })
  activeUsers: number;

  @ApiProperty({
    description: "Suspension history",
    type: [SuspensionHistoryItemDto],
  })
  suspensionHistory: SuspensionHistoryItemDto[];
}
