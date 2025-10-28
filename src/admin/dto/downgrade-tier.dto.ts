import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsIn } from "class-validator";

export class DowngradeTierDto {
  @ApiProperty({
    example: "tier_free",
    description: "Target tier ID to downgrade to",
    enum: ["tier_free", "tier_standard", "tier_premium"],
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(["tier_free", "tier_standard", "tier_premium"], {
    message:
      "targetTierId must be one of: tier_free, tier_standard, tier_premium",
  })
  targetTierId: string;

  @ApiProperty({ example: "Payment declined multiple times" })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
