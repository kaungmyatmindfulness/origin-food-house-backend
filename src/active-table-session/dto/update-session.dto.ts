import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

import { SessionStatus } from "src/generated/prisma/client";

export class UpdateSessionDto {
  @ApiProperty({
    description: "Number of guests in the session",
    example: 4,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiProperty({
    description: "Session status",
    enum: SessionStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
