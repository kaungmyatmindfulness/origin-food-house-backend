import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VariationDto {
  @ApiProperty({ example: 'Extra Spicy' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 1.5,
    description: 'Additional price beyond basePrice for this variation',
  })
  @IsNumber()
  additionalPrice: number;
}

export class SizeDto {
  @ApiProperty({ example: 'Family Size' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 3.0,
    description: 'Additional price beyond basePrice for this size',
  })
  @IsNumber()
  additionalPrice: number;
}

export class AddOnOptionDto {
  @ApiProperty({ example: 'Extra Peanuts' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 0.5,
    description: 'Additional price for this add-on',
  })
  @IsNumber()
  additionalPrice: number;
}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Kung Pao Chicken' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example:
      'Spicy Sichuan chicken stir-fried with peanuts, chili peppers, and vegetables',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 8.99,
    description: 'Base price if no extras are chosen',
  })
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional({
    description: 'S3 key for the item’s image (from common upload API)',
    example: 'uploads/xyz789-original',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({ example: 2, description: 'Optional category ID' })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({
    type: [VariationDto],
    description: 'Possible variations (e.g. Extra Spicy) with extra cost',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariationDto)
  variations?: VariationDto[];

  @ApiPropertyOptional({
    type: [SizeDto],
    description: 'Available sizes (e.g. Family Size) with extra cost',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeDto)
  sizes?: SizeDto[];

  @ApiPropertyOptional({
    type: [AddOnOptionDto],
    description: 'Add-on options (e.g. Extra Peanuts) each with cost',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddOnOptionDto)
  addOnOptions?: AddOnOptionDto[];
}
