import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class GetPaymentQueueDto {
  @ApiPropertyOptional({
    description: "Page number",
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Filter by payment status",
    enum: ["PENDING_VERIFICATION", "VERIFIED", "ACTIVATED", "REJECTED"],
    example: "PENDING_VERIFICATION",
  })
  @IsOptional()
  @IsEnum(["PENDING_VERIFICATION", "VERIFIED", "ACTIVATED", "REJECTED"])
  status?: string;
}
