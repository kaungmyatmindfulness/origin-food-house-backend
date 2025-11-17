import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  TranslationMap,
  BaseTranslationResponseDto,
} from "src/common/dto/translation.dto";

export class CategoryResponseDto {
  @ApiProperty({ example: 6 })
  id: string;

  @ApiProperty({
    example: "Books",
    description:
      "Category name (default/fallback). Use translations map for localized names.",
  })
  name: string;

  @ApiProperty({ example: 1 })
  storeId: string;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description:
      "Translations map by locale (e.g., { 'en': {...}, 'th': {...} }).",
    example: {
      en: { locale: "en", name: "Appetizers" },
      th: { locale: "th", name: "อาหารว่าง" },
    },
    nullable: true,
  })
  translations?: TranslationMap<BaseTranslationResponseDto>;
}
