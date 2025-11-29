import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from "class-validator";

import { DiscountType } from "src/generated/prisma/client";

/**
 * DTO for applying a discount to an order
 * Supports both percentage and fixed amount discounts
 */
export class ApplyDiscountDto {
  @ApiProperty({
    enum: ["PERCENTAGE", "FIXED_AMOUNT"],
    description: "Type of discount to apply",
    example: "PERCENTAGE",
  })
  @IsEnum(DiscountType, {
    message: "discountType must be either PERCENTAGE or FIXED_AMOUNT",
  })
  discountType: DiscountType;

  @ApiProperty({
    type: String,
    description: "Discount value (percentage or fixed amount)",
    example: "10",
  })
  @IsString({ message: "discountValue must be a string" })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'discountValue must be a valid decimal number (e.g., "10" or "15.00")',
  })
  discountValue: string; // "10" for 10% or "15.00" for $15

  @ApiProperty({
    type: String,
    description: "Reason for applying the discount",
    example: "Loyalty customer",
    minLength: 3,
    maxLength: 200,
  })
  @IsString({ message: "reason must be a string" })
  @MinLength(3, { message: "reason must be at least 3 characters long" })
  @MaxLength(200, { message: "reason must not exceed 200 characters" })
  @Transform(({ value }: { value: string }) => value?.trim())
  reason: string; // "Loyalty customer", "Manager comp", "Special occasion", etc.
}
