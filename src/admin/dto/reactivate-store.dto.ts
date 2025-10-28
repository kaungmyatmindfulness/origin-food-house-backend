import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class ReactivateStoreDto {
  @ApiProperty({
    example: "Issue resolved, reactivating store",
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}
