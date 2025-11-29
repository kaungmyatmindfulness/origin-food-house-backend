import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class RejectPaymentDto {
  @ApiProperty({
    description: "Reason for rejecting the payment request",
    example: "Payment proof does not match the amount specified",
    minLength: 10,
    maxLength: 500,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
