import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsString,
  MinLength,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  ValidateNested,
} from "class-validator";

import { SubscriptionTier, Currency } from "src/generated/prisma/client";

import { BankTransferDetailsDto } from "./bank-transfer-details.dto";

export class CreatePaymentRequestDto {
  @ApiProperty({
    description: "Requested subscription tier",
    enum: ["FREE", "STANDARD", "PREMIUM"],
    example: "STANDARD",
  })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiProperty({
    description: "Store ID for the subscription",
    example: "0194ca3b-...",
  })
  @IsString()
  @MinLength(1)
  storeId: string;

  @ApiProperty({
    description: "Requested subscription duration in days",
    example: 365,
    default: 365,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  requestedDuration?: number = 365;

  @ApiProperty({
    description: "Payment amount (max 2 decimal places)",
    example: 99.99,
    type: "number",
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiProperty({
    description: "Currency for the payment",
    enum: ["THB", "MMK", "USD", "EUR", "JPY", "CNY", "SGD", "HKD"],
    example: "USD",
    default: "USD",
  })
  @IsEnum(Currency)
  @IsOptional()
  currency?: Currency = Currency.USD;

  @ApiPropertyOptional({
    type: () => BankTransferDetailsDto,
    description: "Bank transfer details for payment verification",
    example: {
      bankName: "Bank of America",
      accountNumber: "****1234",
      transferDate: "2025-01-15",
      referenceNumber: "TXN123456",
    },
    nullable: true,
  })
  @ValidateNested()
  @Type(() => BankTransferDetailsDto)
  @IsOptional()
  bankTransferDetails?: BankTransferDetailsDto;
}
