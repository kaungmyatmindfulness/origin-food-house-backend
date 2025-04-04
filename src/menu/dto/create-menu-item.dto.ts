import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class UpsertCategoryDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ example: 'Main Dishes' })
  @IsString()
  name: string;
}

class UpsertVariationDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ example: 'Extra Spicy' })
  @IsString()
  name: string;

  @ApiProperty({ example: 1.5, description: 'Additional price' })
  @IsNumber()
  additionalPrice: number;
}

class UpsertSizeDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ example: 'Family Size' })
  @IsString()
  name: string;

  @ApiProperty({ example: 3.0 })
  @IsNumber()
  additionalPrice: number;
}

class UpsertAddOnOptionDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ example: 'Extra Peanuts' })
  @IsString()
  name: string;

  @ApiProperty({ example: 0.5 })
  @IsNumber()
  additionalPrice: number;
}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Kung Pao Chicken' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 8.99 })
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional({ example: 'uploads/xyz789-original' })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({
    type: UpsertCategoryDto,
    description: 'If id => update existing, else create new category',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertCategoryDto)
  category?: UpsertCategoryDto;

  @ApiPropertyOptional({
    type: [UpsertVariationDto],
    description: 'Variations with optional id => update else create',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertVariationDto)
  variations?: UpsertVariationDto[];

  @ApiPropertyOptional({ type: [UpsertSizeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertSizeDto)
  sizes?: UpsertSizeDto[];

  @ApiPropertyOptional({ type: [UpsertAddOnOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertAddOnOptionDto)
  addOnOptions?: UpsertAddOnOptionDto[];
}
