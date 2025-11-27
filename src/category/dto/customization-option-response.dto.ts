import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import { BaseTranslationResponseDto } from "src/common/dto/translation.dto";

export class CustomizationOptionResponseDto {
  @ApiProperty({ example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })
  id: string;

  @ApiProperty({ example: "Large" })
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: "3.25" })
  additionalPrice: string | null;

  @ApiProperty({ example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })
  customizationGroupId: string;

  @ApiPropertyOptional({
    description: "Translations for the customization option name.",
    type: () => [BaseTranslationResponseDto],
    example: [
      { locale: "en", name: "Large" },
      { locale: "th", name: "ใหญ่" },
    ],
  })
  @Type(() => BaseTranslationResponseDto)
  translations?: BaseTranslationResponseDto[];
}
