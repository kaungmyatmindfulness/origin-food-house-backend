import { ApiProperty } from "@nestjs/swagger";

import { Decimal } from "src/common/types/decimal.type";
import { PaymentMethod } from "src/generated/prisma/client";

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

  @ApiProperty({ nullable: true })
  transactionId: string | null;

  @ApiProperty({ nullable: true })
  notes: string | null;

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

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty({ nullable: true })
  refundedBy: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
