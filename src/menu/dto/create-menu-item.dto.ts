import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VariationDto {
  @ApiProperty({ example: 'Beef' })
  name: string;

  @ApiProperty({
    example: 2.0,
    description: 'Additional price beyond basePrice',
  })
  additionalPrice: number;
}

export class SizeDto {
  @ApiProperty({ example: 'Large' })
  name: string;

  @ApiProperty({
    example: 2.0,
    description: 'Additional price beyond basePrice',
  })
  additionalPrice: number;
}

export class AddOnOptionDto {
  @ApiProperty({ example: 'Extra Cheese' })
  name: string;

  @ApiProperty({ example: 0.5 })
  additionalPrice: number;
}

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Tuscan Chicken' })
  name: string;

  @ApiPropertyOptional({ example: 'Grilled chicken with garlic and rosemary' })
  description?: string;

  @ApiProperty({
    example: 4.99,
    description: 'Base price if no extras are chosen',
  })
  basePrice: number;

  @ApiPropertyOptional({
    description: 'S3 key for the item’s image (from common upload API)',
    example: 'uploads/abc123-original',
  })
  imageKey?: string;

  @ApiPropertyOptional({ example: 10, description: 'Optional category ID' })
  categoryId?: number;

  @ApiPropertyOptional({
    type: [VariationDto],
    description: 'Possible variations (beef, chicken, etc.) with extra cost',
  })
  variations?: VariationDto[];

  @ApiPropertyOptional({
    type: [SizeDto],
    description: 'Available sizes (small, medium, large) with extra cost',
  })
  sizes?: SizeDto[];

  @ApiPropertyOptional({
    type: [AddOnOptionDto],
    description: 'Add-on options (extra cheese, etc.) each with cost',
  })
  addOnOptions?: AddOnOptionDto[];
}
