import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for specifying a menu item and its selected customizations
 * when adding it to an order chunk.
 */
export class CreateOrderChunkItemDto {
  @ApiProperty({
    description: 'ID (UUID) of the MenuItem being ordered.',
    format: 'uuid',
    example: '018eb1b4-9183-7a94-b723-f7f5f5ddb0af',
  })
  @IsNotEmpty({ message: 'menuItemId cannot be empty.' })
  @IsUUID('all', { message: 'menuItemId must be a valid UUID.' })
  menuItemId: string;

  @ApiProperty({
    description: 'Quantity of this menu item being ordered.',
    example: 1,
    minimum: 1,
    type: Number,
  })
  @IsNotEmpty({ message: 'quantity cannot be empty.' })
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  quantity: number;

  @ApiPropertyOptional({
    description:
      'Array of IDs (UUIDs) of the chosen CustomizationOptions for this item.',
    type: [String],
    format: 'uuid',
    example: [
      '018ebd1f-c7ff-7daa-8324-3a8f0a2e1a78',
      '018ebd1f-c805-7180-8598-d07f716f6c60',
    ],
  })
  @IsOptional()
  @IsArray({ message: 'customizationOptionIds must be an array.' })
  @IsUUID('all', {
    each: true,
    message: 'Each customizationOptionId must be a valid UUID.',
  })
  customizationOptionIds?: string[];

  @ApiPropertyOptional({
    description:
      'Optional special instructions or notes for this specific item.',
    example: 'Extra spicy, no onions please.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
