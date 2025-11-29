import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MinLength } from "class-validator";

export class CreateRefundRequestDto {
  @ApiProperty({
    description: "Subscription ID for the refund request",
    example: "sub_abc1",
  })
  @IsString()
  subscriptionId: string;

  @ApiProperty({
    description: "Reason for requesting refund",
    minLength: 10,
    example: "Not satisfied with the service quality",
  })
  @IsString()
  @MinLength(10)
  @Transform(({ value }: { value: string }) => value?.trim())
  reason: string;
}
