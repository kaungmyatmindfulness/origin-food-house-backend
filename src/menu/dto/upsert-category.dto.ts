// src/menu/dto/upsert-category.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertCategoryDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'ID of existing category to update',
  })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ example: 'Main Dishes' })
  @IsString()
  name: string;
}
