import { ApiProperty } from "@nestjs/swagger";
import { SessionStatus } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";

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
