// src/cart/dto/add-item-to-cart.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ArrayUnique,
} from 'class-validator';

export class AddItemToCartDto {
  @ApiProperty({
    description: 'ID (UUID) of the MenuItem being added to the cart.',
    format: 'uuid',
    example: '018eb1b4-9183-7a94-b723-f7f5f5ddb0af',
  })
  @IsNotEmpty({ message: 'menuItemId cannot be empty.' })
  @IsUUID('all', { message: 'menuItemId must be a valid UUID.' })
  menuItemId: string;

  @ApiProperty({
    description: 'Quantity of this menu item configuration being added.',
    example: 1,
    minimum: 1,
    type: Number,
  })
  @IsNotEmpty({ message: 'quantity cannot be empty.' })
  @Type(() => Number) // Ensure transformation
  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Array of IDs (UUIDs) of the chosen CustomizationOptions for this item.',
    type: [String],
    format: 'uuid',
    example: ['018ebd1f-c7ff-7daa-8324-3a8f0a2e1a78'],
  })
  @IsOptional()
  @IsArray({ message: 'selectedOptionIds must be an array.' })
  @IsUUID('all', {
    each: true,
    message: 'Each selectedOptionId must be a valid UUID.',
  })
  @ArrayUnique({ message: 'Selected option IDs must be unique.' }) // Prevent sending duplicate option IDs
  selectedOptionIds?: string[];

  @ApiPropertyOptional({
    description: 'Optional special instructions or notes for this cart item.',
    example: 'Extra spicy, no onions please.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
