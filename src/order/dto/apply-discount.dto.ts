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
  @IsEnum(DiscountType, {
    message: "discountType must be either PERCENTAGE or FIXED_AMOUNT",
  })
  discountType: DiscountType;

  @IsString({ message: "discountValue must be a string" })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message:
      'discountValue must be a valid decimal number (e.g., "10" or "15.00")',
  })
  discountValue: string; // "10" for 10% or "15.00" for $15

  @IsString({ message: "reason must be a string" })
  @MinLength(3, { message: "reason must be at least 3 characters long" })
  @MaxLength(200, { message: "reason must not exceed 200 characters" })
  reason: string; // "Loyalty customer", "Manager comp", "Special occasion", etc.
}
