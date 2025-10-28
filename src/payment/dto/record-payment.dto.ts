import { ApiProperty } from "@nestjs/swagger";
import { PaymentMethod } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

import { IsPositiveNumericString } from "../../common/decorators/is-positive-numeric-string.decorator";

export class RecordPaymentDto {
  @ApiProperty({
    description: "Payment amount (as string for Decimal precision)",
    example: "150.00",
  })
  @IsPositiveNumericString()
  amount: string;

  @ApiProperty({
    description: "Payment method",
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: "Amount tendered by customer (for cash payments only)",
    example: "200.00",
    required: false,
  })
  @IsOptional()
  @IsPositiveNumericString()
  amountTendered?: string;

  @ApiProperty({
    description: "External transaction ID (for card/mobile payments)",
    example: "TXN123456789",
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({
    description: "Additional notes",
    example: "Paid in full",
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
