import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  TranslationMap,
  BaseTranslationResponseDto,
} from "src/common/dto/translation.dto";

export class MenuCustomizationOptionDto {
  @ApiProperty({ format: "uuid" })
  @Expose()
  id: string;

  @ApiProperty({
    description:
      "Option name (default/fallback). Use translations map for localized names.",
  })
  @Expose()
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  @Type(() => String)
  additionalPrice?: string | null;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: {
      $ref: "#/components/schemas/BaseTranslationResponseDto",
    },
    description:
      "Translations map by locale (e.g., { 'en': {...}, 'th': {...} }).",
    example: {
      en: { locale: "en", name: "Large" },
      th: { locale: "th", name: "ใหญ่" },
    },
    nullable: true,
  })
  @Expose()
  translations?: TranslationMap<BaseTranslationResponseDto>;
}
