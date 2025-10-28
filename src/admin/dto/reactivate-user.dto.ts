import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ReactivateUserDto {
  @ApiProperty({
    example: "Issue resolved, reactivating user",
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
