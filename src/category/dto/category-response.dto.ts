import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { MenuItemNestedResponseDto } from './menu-item-nested-response.dto';

/**
 * Represents a Category including its associated MenuItems for API responses.
 */
export class CategoryResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the category.',
    example: 6,
  })
  id: string;

  @ApiProperty({ description: 'Name of the category.', example: 'Books' })
  name: string;

  @ApiProperty({
    description: 'ID (UUID) of the store this category belongs to.',
    example: 1,
  })
  storeId: string;

  @ApiProperty({
    description: 'Sort order of the category within the store.',
    example: 1,
  })
  sortOrder: number;

  @ApiProperty({ description: 'Timestamp when the category was created.' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the category was last updated.' })
  updatedAt: Date;

  @ApiProperty({
    description:
      'Menu items belonging to this category, ordered by their sortOrder.',
    type: () => [MenuItemNestedResponseDto],
  })
  @Type(() => MenuItemNestedResponseDto)
  menuItems: MenuItemNestedResponseDto[];
}
