import { ApiPropertyOptional } from '@nestjs/swagger';
import { VariationDto, SizeDto, AddOnOptionDto } from './create-menu-item.dto';

export class UpdateMenuItemDto {
  @ApiPropertyOptional({
    example: 'Kung Pao Chicken',
    description: 'The name of the menu item (Chinese cuisine example)',
  })
  name?: string;

  @ApiPropertyOptional({
    example:
      'Spicy Sichuan chicken stir-fried with peanuts, chili peppers, and vegetables',
    description: 'A detailed description of the dish',
  })
  description?: string;

  @ApiPropertyOptional({
    example: 8.99,
    description: 'Base price of the dish if no extras are chosen',
  })
  basePrice?: number;

  @ApiPropertyOptional({
    example: 'uploads/kungpao123-original',
    description: 'S3 key for the item’s new image (if changed)',
  })
  imageKey?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Optional category ID for the menu item',
  })
  categoryId?: number;

  @ApiPropertyOptional({
    type: [VariationDto],
    example: [{ name: 'Extra Spicy', additionalPrice: 1.5 }],
    description: 'Possible variations (e.g. extra spicy) with additional cost',
  })
  variations?: VariationDto[];

  @ApiPropertyOptional({
    type: [SizeDto],
    example: [{ name: 'Family Size', additionalPrice: 3.0 }],
    description: 'Available sizes (e.g. family size) with extra cost',
  })
  sizes?: SizeDto[];

  @ApiPropertyOptional({
    type: [AddOnOptionDto],
    example: [{ name: 'Extra Peanuts', additionalPrice: 0.5 }],
    description: 'Additional add-on options with additional cost',
  })
  addOnOptions?: AddOnOptionDto[];
}
