import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class SuspendUserDto {
  @ApiProperty({ example: "Suspicious activity detected" })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  reason: string;
}
