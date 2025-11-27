import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  PaymentStatus,
  RefundStatus,
  TransferStatus,
} from "src/generated/prisma/client";

/**
 * DTO for subscription response
 */
export class SubscriptionResponseDto {
  @ApiProperty({ description: "Subscription ID", example: "0194ca3b-..." })
  id: string;

  @ApiProperty({ description: "Store ID", example: "0194ca3b-..." })
  storeId: string;

  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    description: "Current tier",
    example: "STANDARD",
  })
  tier: SubscriptionTier;

  @ApiProperty({
    enum: ["TRIAL", "ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED"],
    description: "Subscription status",
    example: "ACTIVE",
  })
  status: SubscriptionStatus;

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
    description: "Trial end date (if on trial)",
    example: "2025-01-15T00:00:00.000Z",
  })
  trialEndsAt?: Date;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * DTO for trial eligibility response
 * Note: The service returns a boolean directly
 */
export class TrialEligibilityResponseDto {
  @ApiProperty({
    description: "Whether user is eligible for trial",
    example: true,
  })
  eligible: boolean;
}

/**
 * DTO for trial info response
 */
export class TrialInfoResponseDto {
  @ApiProperty({
    description: "Whether store is currently on trial",
    example: true,
  })
  isTrialActive: boolean;

  @ApiPropertyOptional({
    description: "Trial start date",
    example: "2025-01-01T00:00:00.000Z",
  })
  trialStartedAt?: Date | null;

  @ApiPropertyOptional({
    description: "Trial end date",
    example: "2025-01-15T00:00:00.000Z",
  })
  trialEndsAt?: Date | null;

  @ApiProperty({
    description: "Days remaining in trial",
    example: 7,
  })
  daysRemaining: number;

  @ApiProperty({
    description: "Whether the store can start a new trial",
    example: false,
  })
  canStartTrial: boolean;
}

/**
 * DTO for payment request response
 * Maps to PaymentRequest Prisma model
 */
export class PaymentRequestResponseDto {
  @ApiProperty({ description: "Payment request ID", example: "0194ca3b-..." })
  id: string;

  @ApiProperty({ description: "Subscription ID", example: "0194ca3b-..." })
  subscriptionId: string;

  @ApiProperty({
    enum: ["PENDING_VERIFICATION", "VERIFIED", "ACTIVATED", "REJECTED"],
    description: "Payment request status",
    example: "PENDING_VERIFICATION",
  })
  status: PaymentStatus;

  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    description: "Requested subscription tier",
    example: "PREMIUM",
  })
  requestedTier: SubscriptionTier;

  @ApiPropertyOptional({
    description: "Payment proof image path",
    example: "payment-proofs/store-id/uuid-original.jpg",
  })
  paymentProofPath?: string | null;

  @ApiPropertyOptional({
    description: "Admin notes",
    example: "Payment verified",
  })
  notes?: string | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * DTO for refund request response
 * Maps to RefundRequest Prisma model
 */
export class RefundRequestResponseDto {
  @ApiProperty({ description: "Refund request ID", example: "0194ca3b-..." })
  id: string;

  @ApiProperty({ description: "Subscription ID", example: "0194ca3b-..." })
  subscriptionId: string;

  @ApiProperty({ description: "Transaction ID", example: "0194ca3b-..." })
  transactionId: string;

  @ApiProperty({
    description: "Requested refund amount (Decimal)",
    example: "99.00",
    type: "string",
  })
  requestedAmount: unknown; // Prisma Decimal - serializes to string in JSON

  @ApiProperty({
    description: "Reason for refund request",
    example: "Not satisfied with the service",
  })
  reason: string;

  @ApiProperty({
    enum: ["REQUESTED", "APPROVED", "REJECTED", "PROCESSED"],
    description: "Refund status",
    example: "REQUESTED",
  })
  status: RefundStatus;

  @ApiProperty({
    description: "User who requested the refund",
    example: "0194ca3b-...",
  })
  requestedBy: string;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * DTO for ownership transfer response
 * Maps to OwnershipTransfer Prisma model
 */
export class OwnershipTransferResponseDto {
  @ApiProperty({ description: "Transfer ID", example: "0194ca3b-..." })
  id: string;

  @ApiProperty({ description: "Store ID", example: "0194ca3b-..." })
  storeId: string;

  @ApiProperty({
    enum: ["PENDING_OTP", "COMPLETED", "EXPIRED", "CANCELLED"],
    description: "Transfer status",
    example: "PENDING_OTP",
  })
  status: TransferStatus;

  @ApiPropertyOptional({
    description: "Notes about the transfer",
    example: "Ownership transfer for business sale",
  })
  notes?: string | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}
