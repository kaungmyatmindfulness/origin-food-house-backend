import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  PaymentStatus,
  SubscriptionTier,
  Currency,
} from "src/generated/prisma/client";

/**
 * Store info for payment list items
 */
export class PaymentStoreInfoDto {
  @ApiProperty({ description: "Store ID" })
  id: string;

  @ApiProperty({ description: "Store slug" })
  slug: string;

  @ApiPropertyOptional({
    type: String,
    description: "Store name",
    nullable: true,
  })
  name: string | null;
}

/**
 * Payment request list item response
 */
export class PaymentResponseDto {
  @ApiProperty({ description: "Payment request ID" })
  id: string;

  @ApiProperty({
    enum: ["PENDING_VERIFICATION", "VERIFIED", "ACTIVATED", "REJECTED"],
    description: "Payment request status",
  })
  status: PaymentStatus;

  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    description: "Requested subscription tier",
  })
  requestedTier: SubscriptionTier;

  @ApiProperty({ description: "Payment amount", type: "string" })
  amount: string;

  @ApiProperty({
    enum: ["THB", "MMK", "USD", "EUR", "JPY", "CNY", "SGD", "HKD"],
    description: "Currency",
  })
  currency: Currency;

  @ApiPropertyOptional({
    description: "Store information",
    type: PaymentStoreInfoDto,
  })
  store: PaymentStoreInfoDto | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * Payment request detail response
 */
export class PaymentDetailResponseDto {
  @ApiProperty({ description: "Payment request ID" })
  id: string;

  @ApiProperty({ description: "Subscription ID" })
  subscriptionId: string;

  @ApiProperty({
    enum: ["PENDING_VERIFICATION", "VERIFIED", "ACTIVATED", "REJECTED"],
    description: "Payment request status",
  })
  status: PaymentStatus;

  @ApiProperty({
    enum: ["FREE", "STANDARD", "PREMIUM"],
    description: "Requested subscription tier",
  })
  requestedTier: SubscriptionTier;

  @ApiProperty({ description: "Payment amount", type: "string" })
  amount: string;

  @ApiProperty({
    enum: ["THB", "MMK", "USD", "EUR", "JPY", "CNY", "SGD", "HKD"],
    description: "Currency",
  })
  currency: Currency;

  @ApiPropertyOptional({
    type: Number,
    description: "Requested duration in days",
    nullable: true,
  })
  requestedDuration: number | null;

  @ApiPropertyOptional({
    type: String,
    description: "Payment proof path",
    nullable: true,
  })
  paymentProofPath: string | null;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Bank transfer details",
    nullable: true,
  })
  bankTransferDetails: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: String,
    description: "Admin notes",
    nullable: true,
  })
  notes: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Verified by admin ID",
    nullable: true,
  })
  verifiedBy: string | null;

  @ApiPropertyOptional({
    type: Date,
    description: "Verified at timestamp",
    nullable: true,
  })
  verifiedAt: Date | null;

  @ApiPropertyOptional({
    type: String,
    description: "Activated by admin ID",
    nullable: true,
  })
  activatedBy: string | null;

  @ApiPropertyOptional({
    type: Date,
    description: "Activated at timestamp",
    nullable: true,
  })
  activatedAt: Date | null;

  @ApiPropertyOptional({
    type: String,
    description: "Rejected by admin ID",
    nullable: true,
  })
  rejectedBy: string | null;

  @ApiPropertyOptional({
    type: Date,
    description: "Rejected at timestamp",
    nullable: true,
  })
  rejectedAt: Date | null;

  @ApiPropertyOptional({
    type: String,
    description: "Rejection reason",
    nullable: true,
  })
  rejectionReason: string | null;

  @ApiProperty({ description: "Created at timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}

/**
 * Payment action response (for verify, reject)
 */
export class PaymentActionResponseDto {
  @ApiProperty({ description: "Payment request ID" })
  id: string;

  @ApiProperty({
    enum: ["PENDING_VERIFICATION", "VERIFIED", "ACTIVATED", "REJECTED"],
    description: "Payment request status",
  })
  status: PaymentStatus;

  @ApiPropertyOptional({
    type: String,
    description: "Admin notes",
    nullable: true,
  })
  notes: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Rejection reason",
    nullable: true,
  })
  rejectionReason: string | null;

  @ApiProperty({ description: "Updated at timestamp" })
  updatedAt: Date;
}
