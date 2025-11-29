import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { Decimal } from "src/common/types/decimal.type";
import { PaymentMethod } from "src/generated/prisma/client";

import { SplitMetadataDto } from "./split-types.dto";

export class PaymentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty({ type: String })
  amount: Decimal;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty({ type: String, nullable: true })
  amountTendered: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  change: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  transactionId: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Type of bill split (EQUAL, CUSTOM, BY_ITEM)",
    example: "EQUAL",
  })
  splitType: string | null;

  @ApiPropertyOptional({
    type: () => SplitMetadataDto,
    nullable: true,
    description: "Metadata containing split payment details",
    example: { guestCount: 4, amountPerGuest: "25.00" },
  })
  splitMetadata: SplitMetadataDto | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Guest number for split payment",
    example: 1,
  })
  guestNumber: number | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: "Soft delete timestamp",
  })
  deletedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RefundResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty({ type: String })
  amount: Decimal;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;

  @ApiProperty({ type: String, nullable: true })
  refundedBy: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
