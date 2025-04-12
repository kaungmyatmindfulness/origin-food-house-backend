import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { SortMenuItemDto } from './sort-menu-item.dto';

export class SortCategoryDto {
  @ApiProperty({ example: 1, description: 'Category ID' })
  @IsInt()
  @Min(1)
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
