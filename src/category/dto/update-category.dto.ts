import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional } from "class-validator";

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: "Desserts" })
  @IsOptional()
  @IsString()
  name?: string;
}
