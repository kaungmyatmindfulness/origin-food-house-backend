import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SortMenuItemDto {
  @ApiProperty({ example: 1, description: 'Menu item ID' })
  @IsInt()
  @Min(1)
  id: string;

  @ApiProperty({ example: 2, description: 'Sort order for this menu item' })
  @IsInt()
  sortOrder: number;
}
