import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class OrderChunkItemDto {
  @ApiProperty({ example: 5, description: 'ID (UUID) of the menu item' })
  @IsUUID(7, { message: 'menuItemId must be a valid UUID string' })
  menuItemId: string;

  @ApiProperty({ example: 4.99, description: 'Unit price of the menu item' })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 2, description: 'Quantity ordered' })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({ example: 9.98, description: 'Final price (optional)' })
  @IsOptional()
  @IsNumber()
  finalPrice?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Chosen variation ID (optional)',
  })
  @IsOptional()
  @IsInt()
  chosenVariationId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Chosen size ID (optional)' })
  @IsOptional()
  @IsInt()
  chosenSizeId?: number;

  @ApiPropertyOptional({ description: 'Chosen add-ons (optional)' })
  @IsOptional()
  chosenAddOns?: any;

  @ApiPropertyOptional({
    example: 'Less salt, please',
    description: 'Special instructions (optional)',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
