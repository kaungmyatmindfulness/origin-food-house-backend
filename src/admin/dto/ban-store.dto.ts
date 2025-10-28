import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class BanStoreDto {
  @ApiProperty({ example: "Repeated terms of service violations" })
  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  reason: string;
}
