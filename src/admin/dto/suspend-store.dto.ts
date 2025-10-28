import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class SuspendStoreDto {
  @ApiProperty({ example: "Payment fraud detected" })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  reason: string;
}
