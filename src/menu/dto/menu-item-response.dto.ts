import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoutingArea } from '@prisma/client';
import { Type } from 'class-transformer';

import { CategoryResponseDto } from './category-response.dto';
import { CustomizationGroupResponseDto } from './customization-group-response.dto';

export class MenuItemResponseDto {
  @ApiProperty({ example: 147 })
  id: string;

  @ApiProperty({ example: 'Generic Granite Cheese' })
  name: string;

  @ApiPropertyOptional({
    example: 'The lavender Bike combines Bolivia aesthetics...',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'Base price, formatted as string.',
    example: '49.11',
    type: String,
    nullable: false,
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

  @ApiProperty({
    description: 'Indicates if the item is currently out of stock.',
    example: false,
  })
  isOutOfStock: boolean;

  @ApiProperty({
    enum: RoutingArea,
    description: 'Kitchen routing area for this item',
    example: RoutingArea.GRILL,
  })
  routingArea: RoutingArea;

  @ApiPropertyOptional({
    description: 'Expected preparation time in minutes',
    example: 15,
    type: Number,
    nullable: true,
  })
  preparationTimeMinutes: number | null;

  @ApiProperty({ example: 6 })
  categoryId: string;

  @ApiProperty({ example: 1 })
  storeId: string;

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
