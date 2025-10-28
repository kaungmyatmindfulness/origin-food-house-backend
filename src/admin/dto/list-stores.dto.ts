import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, IsInt, Min, IsIn } from "class-validator";

export class ListStoresDto {
  @ApiProperty({ required: false, example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false, example: "pizza-paradise" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    example: "ACTIVE",
    enum: ["ACTIVE", "SUSPENDED", "BANNED"],
  })
  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED", "BANNED"])
  status?: string;

  @ApiProperty({ required: false, example: "tier_premium" })
  @IsOptional()
  @IsString()
  tierId?: string;
}
