import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, MinLength } from "class-validator";

export enum SubscriptionTier {
  FREE = "FREE",
  STANDARD = "STANDARD",
  PREMIUM = "PREMIUM",
}

export class CreatePaymentRequestDto {
  @ApiProperty({
    description: "Requested subscription tier",
    enum: SubscriptionTier,
    example: SubscriptionTier.STANDARD,
  })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiProperty({
    description: "Store ID for the subscription",
    example: "abc1234",
  })
  @IsString()
  @MinLength(1)
  storeId: string;
}
