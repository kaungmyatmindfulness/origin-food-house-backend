import { Tier, SubscriptionStatus, BillingCycle } from '@prisma/client';

export class TierResponseDto {
  id: string;
  storeId: string;
  tier: Tier;
  subscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class TierUsageResponseDto {
  tables: number;
  menuItems: number;
  staff: number;
  ordersThisMonth: number;
}

export class TierLimitCheckResponseDto {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  tier: Tier;
  usagePercentage: number; // Calculated: (currentUsage / limit) * 100
}
