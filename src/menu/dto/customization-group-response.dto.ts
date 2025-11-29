import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import {
  TranslationMap,
  BaseTranslationResponseDto,
} from "src/common/dto/translation.dto";

import { MenuCustomizationOptionDto } from "./customization-option-response.dto";

export class MenuCustomizationGroupDto {
  @ApiProperty({ example: 219 })
  id: string;

  @ApiProperty({
    example: "Size",
    description:
      "Group name (default/fallback). Use translations map for localized names.",
  })
  name: string;

  @ApiProperty({ example: false })
  required: boolean;

  @ApiProperty({ example: 0 })
  minSelectable: number;

  @ApiProperty({ example: 1 })
  maxSelectable: number;

  @ApiProperty({ example: 147 })
  menuItemId: string;

  @ApiProperty({ type: () => [MenuCustomizationOptionDto] })
  @Type(() => MenuCustomizationOptionDto)
  customizationOptions: MenuCustomizationOptionDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: {
      $ref: "#/components/schemas/BaseTranslationResponseDto",
    },
    description:
      "Translations map by locale (e.g., { 'en': {...}, 'th': {...} }).",
    example: {
      en: { locale: "en", name: "Size" },
      th: { locale: "th", name: "ขนาด" },
    },
    nullable: true,
  })
  translations?: TranslationMap<BaseTranslationResponseDto>;
}
