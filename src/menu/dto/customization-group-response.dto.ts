import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import {
  TranslationMap,
  BaseTranslationResponseDto,
} from "src/common/dto/translation.dto";

import { CustomizationOptionResponseDto } from "./customization-option-response.dto";

export class CustomizationGroupResponseDto {
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

  @ApiProperty({ type: () => [CustomizationOptionResponseDto] })
  @Type(() => CustomizationOptionResponseDto)
  customizationOptions: CustomizationOptionResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
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
