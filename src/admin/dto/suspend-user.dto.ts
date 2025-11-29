import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class AdminSuspendUserDto {
  @ApiProperty({ example: "Suspicious activity detected" })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @Transform(({ value }: { value: string }) => value?.trim())
  reason: string;
}
