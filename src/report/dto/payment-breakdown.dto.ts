import { ApiProperty } from "@nestjs/swagger";
import { PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * DTO for payment method breakdown item
 */
export class PaymentMethodBreakdownDto {
  @ApiProperty({
    description: "Payment method",
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: "Total amount for this payment method",
    type: String,
    example: "5000.00",
  })
  totalAmount: Decimal;

  @ApiProperty({
    description: "Number of transactions",
    example: 50,
  })
  transactionCount: number;

  @ApiProperty({
    description: "Percentage of total sales",
    type: "number",
    example: 40.5,
  })
  percentage: number;
}

/**
 * DTO for payment breakdown report
 */
export class PaymentBreakdownDto {
  @ApiProperty({
    description: "Breakdown by payment method",
    type: [PaymentMethodBreakdownDto],
  })
  breakdown: PaymentMethodBreakdownDto[];

  @ApiProperty({
    description: "Date range start",
  })
  startDate: Date;

  @ApiProperty({
    description: "Date range end",
  })
  endDate: Date;
}
