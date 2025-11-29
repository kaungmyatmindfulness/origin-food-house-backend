import { ApiProperty } from "@nestjs/swagger";

import { Decimal } from "src/common/types/decimal.type";
import {
  OrderStatus,
  OrderType,
  DiscountType,
} from "src/generated/prisma/client";

export class OrderItemCustomizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customizationOptionId: string;

  @ApiProperty({ type: String, nullable: true })
  finalPrice: Decimal | null;
}

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: String, nullable: true })
  menuItemId: string | null;

  @ApiProperty({ type: String })
  price: Decimal;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ type: String, nullable: true })
  finalPrice: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: [OrderItemCustomizationResponseDto] })
  customizations: OrderItemCustomizationResponseDto[];
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  storeId: string;

  @ApiProperty({ type: String, nullable: true })
  sessionId: string | null;

  @ApiProperty()
  tableName: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: OrderType })
  orderType: OrderType;

  @ApiProperty({ type: Date, nullable: true })
  paidAt: Date | null;

  @ApiProperty({ type: String })
  subTotal: Decimal;

  @ApiProperty({ type: String, nullable: true })
  vatRateSnapshot: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  serviceChargeRateSnapshot: Decimal | null;

  @ApiProperty({ type: String })
  vatAmount: Decimal;

  @ApiProperty({ type: String })
  serviceChargeAmount: Decimal;

  @ApiProperty({ type: String })
  grandTotal: Decimal;

  // Discount fields
  @ApiProperty({ enum: DiscountType, nullable: true })
  discountType: DiscountType | null;

  @ApiProperty({ type: String, nullable: true })
  discountValue: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  discountAmount: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  discountReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  discountAppliedBy: string | null;

  @ApiProperty({ type: Date, nullable: true })
  discountAppliedAt: Date | null;

  @ApiProperty({
    type: String,
    description:
      "Total amount paid across all payments (supports bill splitting)",
  })
  totalPaid: string;

  @ApiProperty({ type: String, description: "Remaining balance to be paid" })
  remainingBalance: string;

  @ApiProperty({ description: "Whether the order is fully paid" })
  isPaidInFull: boolean;

  @ApiProperty({ type: [OrderItemResponseDto] })
  orderItems: OrderItemResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
