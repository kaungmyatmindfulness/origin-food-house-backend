// src/menu/dto/menu-item-response.dto.ts
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
    type: String, // Explicitly type as string for Swagger
    nullable: true,
  })
  basePrice: string | null; // Prisma Decimal serializes to string

  @ApiPropertyOptional({
    example: null, // Or 'uploads/uuid' if present
    nullable: true,
  })
  imageKey: string | null;

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

  // Nested Objects/Arrays
  @ApiProperty({ type: () => CategoryResponseDto }) // Important for nested objects
  @Type(() => CategoryResponseDto) // For potential class-transformer usage
  category: CategoryResponseDto;

  @ApiProperty({ type: () => [CustomizationGroupResponseDto] }) // Important for arrays
  @Type(() => CustomizationGroupResponseDto) // For potential class-transformer usage
  customizationGroups: CustomizationGroupResponseDto[];
}
