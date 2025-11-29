import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class VerifyPaymentDto {
  @ApiPropertyOptional({
    description: "Admin note for the verification",
    example: "Payment receipt verified against bank statement",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
