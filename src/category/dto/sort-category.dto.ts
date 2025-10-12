import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, ValidateNested, IsArray, IsUUID } from 'class-validator';

import { SortMenuItemDto } from './sort-menu-item.dto';

export class SortCategoryDto {
  @ApiProperty({ example: 1, description: 'Category ID (UUID)' })
  @IsUUID(7, { message: 'id must be a valid UUID string' })
  id: string;

  @ApiProperty({ example: 5, description: 'Sort order for this category' })
  @IsInt()
  sortOrder: number;

  @ApiProperty({
    type: [SortMenuItemDto],
    description:
      'List of menu items under this category with updated sort orders',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortMenuItemDto)
  menuItems: SortMenuItemDto[];
}
