import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class UploadPaymentProofDto {
  @ApiProperty({
    description: "Payment request ID",
    example: "pr_abc1",
  })
  @IsString()
  paymentRequestId: string;
}
