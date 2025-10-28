import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class RejectPaymentDto {
  @ApiProperty({
    description: "Reason for rejecting the payment",
    minLength: 10,
    example: "Payment proof is unclear or invalid",
  })
  @IsString()
  @MinLength(10)
  rejectionReason: string;
}
