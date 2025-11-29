import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, IsOptional } from "class-validator";

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: "Desserts" })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  name?: string;
}
