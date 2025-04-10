import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CategoryResponseDto } from './category-response.dto';
import { CustomizationGroupResponseDto } from './customization-group-response.dto';

export class MenuItemResponseDto {
  @ApiProperty({ example: 147 })
  id: number;

  @ApiProperty({ example: 'Generic Granite Cheese' })
  name: string;

  @ApiPropertyOptional({
    example: 'The lavender Bike combines Bolivia aesthetics...',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Base price, formatted as string.',
    example: '49.11',
    type: String,
    nullable: true,
  })
  basePrice: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
  })
  imageUrl: string | null;

  @ApiProperty({
    description:
      'Indicates if the item is temporarily hidden (e.g., out of stock).',
    example: false,
  })
  isHidden: boolean;

  @ApiProperty({ example: 6 })
  categoryId: number;

  @ApiProperty({ example: 1 })
  storeId: number;

  @ApiProperty({ example: 2 })
  sortOrder: number;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ type: () => CategoryResponseDto })
  @Type(() => CategoryResponseDto)
  category: CategoryResponseDto;

  @ApiProperty({ type: () => [CustomizationGroupResponseDto] })
  @Type(() => CustomizationGroupResponseDto)
  customizationGroups: CustomizationGroupResponseDto[];
}
