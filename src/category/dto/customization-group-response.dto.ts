import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import { BaseTranslationResponseDto } from "src/common/dto/translation.dto";

import { CustomizationOptionResponseDto } from "./customization-option-response.dto";

export class CustomizationGroupResponseDto {
  @ApiProperty({ example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })
  id: string;

  @ApiProperty({ example: "Size" })
  name: string;

  @ApiProperty({ example: false })
  required: boolean;

  @ApiProperty({ example: 0 })
  minSelectable: number;

  @ApiProperty({ example: 1 })
  maxSelectable: number;

  @ApiProperty({ example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })
  menuItemId: string;

  @ApiPropertyOptional({
    description: "Translations for the customization group name.",
    type: () => [BaseTranslationResponseDto],
    example: [
      { locale: "en", name: "Size" },
      { locale: "th", name: "ขนาด" },
    ],
  })
  @Type(() => BaseTranslationResponseDto)
  translations?: BaseTranslationResponseDto[];

  @ApiProperty({ type: () => [CustomizationOptionResponseDto] })
  @Type(() => CustomizationOptionResponseDto)
  customizationOptions: CustomizationOptionResponseDto[];
}
