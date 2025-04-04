// src/menu/dto/create-menu-item.dto.ts
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
    type: Number,
    description: 'Base price before customizations',
  })
  @IsNumber()
  @Min(0)
  basePrice: number | Decimal; // Accept number

  @ApiPropertyOptional({
    example: 'images/krapow-pork.jpg',
    description: 'Key for image stored in S3 or similar',
  })
  @IsOptional()
  @IsString()
  imageKey?: string;

  @ApiProperty({
    type: UpsertCategoryDto,
    description:
      'Category for the item. Provide ID to link/update existing, or just name to create new.',
  })
  @ValidateNested()
  @Type(() => UpsertCategoryDto)
  category: UpsertCategoryDto; // Make category mandatory for creation

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
