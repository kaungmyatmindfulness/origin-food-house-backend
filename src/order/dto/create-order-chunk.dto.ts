// src/order/dto/create-order-chunk.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// Represents a single selected customization for an item
class OrderItemCustomizationDto {
  @ApiProperty({
    description: 'ID of the chosen CustomizationOption',
    example: 101,
  })
  @IsInt()
  optionId: string;

  // Optional: If the same customization can be selected multiple times (e.g., "Extra Cheese" x2)
  // Defaults to 1 if not provided. Add if needed based on requirements.
  // @ApiPropertyOptional({ description: 'Quantity for this specific customization option', example: 1, default: 1 })
  // @IsOptional()
  // @IsInt()
  // @Min(1)
  // quantity?: number;
}

// Represents a single item within the order chunk
class OrderChunkItemDto {
  @ApiProperty({ description: 'ID of the MenuItem being ordered', example: 7 })
  @IsInt()
  menuItemId: string;

  @ApiProperty({ description: 'Number of this item ordered', example: 2 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Any specific notes for this item',
    example: 'Extra spicy, no peanuts',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'List of selected customizations for this item',
    type: [OrderItemCustomizationDto],
    example: [{ optionId: 101 }, { optionId: 205 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemCustomizationDto)
  customizations: OrderItemCustomizationDto[];
}

// Main DTO for creating an order chunk
export class CreateOrderChunkDto {
  @ApiProperty({
    description: 'Array of items included in this chunk',
    type: [OrderChunkItemDto],
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderChunkItemDto)
  items: OrderChunkItemDto[];
}
