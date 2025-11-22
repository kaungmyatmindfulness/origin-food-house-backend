import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

import { SessionType } from "src/generated/prisma/client";

export class CreateManualSessionDto {
  @ApiProperty({
    description: "Type of manual session (COUNTER, PHONE, or TAKEOUT)",
    enum: SessionType,
    example: SessionType.COUNTER,
  })
  @IsEnum(SessionType)
  sessionType: SessionType;

  @ApiProperty({
    description: "Optional customer name",
    example: "John Doe",
    required: false,
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiProperty({
    description: "Optional customer phone number",
    example: "+1234567890",
    required: false,
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiProperty({
    description: "Number of guests in the session",
    example: 2,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;
}
