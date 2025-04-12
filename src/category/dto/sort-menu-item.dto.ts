import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID } from 'class-validator';

export class SortMenuItemDto {
  @ApiProperty({ example: 1, description: 'Menu item ID (UUID)' })
  @IsUUID(7, { message: 'id must be a valid UUID string' })
  id: string;

  @ApiProperty({ example: 2, description: 'Sort order for this menu item' })
  @IsInt()
  sortOrder: number;
}
