import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class VerifyPaymentDto {
  @ApiProperty({
    description: "Admin notes for payment verification",
    required: false,
    example: "Payment verified via bank statement",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}
