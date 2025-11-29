import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
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
  @Transform(({ value }: { value: string }) => value?.trim())
  notes?: string;
}
