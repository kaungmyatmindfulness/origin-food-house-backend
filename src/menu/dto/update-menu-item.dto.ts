// src/menu/dto/update-menu-item.dto.ts
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpsertCategoryDto } from './upsert-category.dto';
import { UpsertCustomizationGroupDto } from './upsert-customization-group.dto';
import { Decimal } from '@prisma/client/runtime/library';

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ example: 'Pad Krapow Moo Kai Dao' })
  @IsOptional() // Make fields optional for partial updates
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example:
      'Stir-fried minced pork with holy basil, served with rice and fried egg.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 10.5,
    type: Number,
    description: 'Base price before customizations',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number | Decimal; // Accept number

  @ApiPropertyOptional({
    example: 'images/krapow-pork-egg.jpg',
    description: 'Key for image stored in S3 or similar',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiPropertyOptional({
    type: UpsertCategoryDto,
    description:
      'Optional: Update or change category. Provide ID to link/update existing, or just name to create new.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertCategoryDto)
  category?: UpsertCategoryDto;

  @ApiPropertyOptional({
    type: [UpsertCustomizationGroupDto],
    description:
      'Optional: Full list of desired customization groups. Provide IDs to update existing groups/options. Groups/options missing IDs will be created. Existing groups/options NOT included in this array (by ID) WILL BE DELETED.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCustomizationGroupDto)
  customizationGroups?: UpsertCustomizationGroupDto[];
}
