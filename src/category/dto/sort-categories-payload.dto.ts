import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';

import { SortCategoryDto } from './sort-category.dto';

export class SortCategoriesPayloadDto {
  @ApiProperty({
    type: [SortCategoryDto],
    description: 'Array of categories + associated menu items sort orders',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortCategoryDto)
  categories: SortCategoryDto[];
}
