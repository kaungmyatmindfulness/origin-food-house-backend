import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class BanUserDto {
  @ApiProperty({ example: "Multiple policy violations" })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  reason: string;
}
