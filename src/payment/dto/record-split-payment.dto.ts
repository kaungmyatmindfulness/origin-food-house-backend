import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { PaymentMethod } from "src/generated/prisma/client";

import { SplitMetadataDto } from "./split-types.dto";
import { IsPositiveNumericString } from "../../common/decorators/is-positive-numeric-string.decorator";

export class RecordSplitPaymentDto {
  @ApiProperty({
    description: "Payment method",
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: "Payment amount (as string for Decimal precision)",
    example: "50.00",
  })
  @IsPositiveNumericString()
  amount: string;

  @ApiProperty({
    description: "Amount tendered by customer (for cash payments only)",
    example: "50.00",
    required: false,
  })
  @IsOptional()
  @IsPositiveNumericString()
  amountTendered?: string;

  @ApiProperty({
    description: "Change to return (calculated automatically for cash)",
    example: "0.00",
    required: false,
  })
  @IsOptional()
  @IsPositiveNumericString()
  change?: string;

  @ApiProperty({
    description: "Split type",
    enum: ["EVEN", "BY_ITEM", "CUSTOM"],
    example: "EVEN",
  })
  @IsEnum(["EVEN", "BY_ITEM", "CUSTOM"])
  splitType: "EVEN" | "BY_ITEM" | "CUSTOM";

  @ApiProperty({
    description: "Guest number for this split payment (1, 2, 3, etc.)",
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  guestNumber: number;

  @ApiPropertyOptional({
    type: () => SplitMetadataDto,
    description: "Split metadata with calculation details",
    example: { guestCount: 2, amountPerGuest: "50.00" },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SplitMetadataDto)
  splitMetadata?: SplitMetadataDto;

  @ApiProperty({
    description: "External transaction ID (for card/mobile payments)",
    example: "TXN123456789",
    required: false,
  })
  @IsOptional()
  @IsString()
  transactionId?: string;
}
