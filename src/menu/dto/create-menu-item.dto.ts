import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';

import { IsPositiveNumericString } from 'src/common/decorators/is-positive-numeric-string.decorator';

import { UpsertCategoryDto } from './upsert-category.dto';
import { UpsertCustomizationGroupDto } from './upsert-customization-group.dto';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Pad Krapow Moo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Stir-fried minced pork with holy basil, served with rice.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 9.5,
    type: String,
    description: 'Base price before customizations',
  })
  @IsPositiveNumericString({
    message:
      'Base price must be a numeric string representing a value of 0.01 or greater',
  })
  basePrice: string;

  @ApiPropertyOptional({
    example: 'images/krapow-pork.jpg',
    description: 'Key for image stored in S3 or similar',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'Set to true to temporarily hide the item (e.g., out of stock). Defaults to false (visible).',
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiProperty({
    type: UpsertCategoryDto,
    description:
      'Category for the item. Provide ID to link/update existing, or just name to create new.',
  })
  @ValidateNested()
  @Type(() => UpsertCategoryDto)
  category: UpsertCategoryDto;

  @ApiPropertyOptional({
    type: [UpsertCustomizationGroupDto],
    description:
      'Optional customization groups (e.g., Size, Spice Level, Add-ons). Omit IDs for new groups/options.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCustomizationGroupDto)
  customizationGroups?: UpsertCustomizationGroupDto[];
}
