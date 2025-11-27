import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class UploadPaymentProofDto {
  @ApiProperty({
    description: "Payment request ID",
    example: "0194ca3b-1234-5678-9abc-def012345678",
  })
  @IsUUID()
  paymentRequestId: string;
}
