import { ApiPropertyOptional } from '@nestjs/swagger';
import { VariationDto, SizeDto, AddOnOptionDto } from './create-menu-item.dto';

export class UpdateMenuItemDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Base price if no extras' })
  basePrice?: number;

  @ApiPropertyOptional({
    description: 'S3 key for the item’s new image (if changed)',
  })
  imageKey?: string;

  @ApiPropertyOptional({
    description: 'Change category if needed',
  })
  categoryId?: number;

  @ApiPropertyOptional({ type: [VariationDto] })
  variations?: VariationDto[];

  @ApiPropertyOptional({ type: [SizeDto] })
  sizes?: SizeDto[];

  @ApiPropertyOptional({ type: [AddOnOptionDto] })
  addOnOptions?: AddOnOptionDto[];
}
