import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";

import {
  BaseTranslationDto,
  TranslationWithDescriptionDto,
} from "src/common/dto/translation.dto";

/**
 * DTO for updating menu item translations
 */
export class UpdateMenuItemTranslationsDto {
  @ApiProperty({
    type: [TranslationWithDescriptionDto],
    description: "Array of translations to add/update",
    example: [
      {
        locale: "th",
        name: "ผัดไทย",
        description: "ก๋วยเตี๋ยวผัดไทยรสอร่อย",
      },
      { locale: "zh", name: "泰式炒河粉", description: "美味的泰国炒面" },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationWithDescriptionDto)
  translations: TranslationWithDescriptionDto[];
}

/**
 * DTO for updating category translations
 */
export class UpdateCategoryTranslationsDto {
  @ApiProperty({
    type: [BaseTranslationDto],
    description: "Array of translations to add/update",
    example: [
      { locale: "th", name: "อาหารเรียกน้ำย่อย" },
      { locale: "zh", name: "开胃菜" },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseTranslationDto)
  translations: BaseTranslationDto[];
}

/**
 * DTO for updating customization group translations
 */
export class UpdateCustomizationGroupTranslationsDto {
  @ApiProperty({
    type: [BaseTranslationDto],
    description: "Array of translations to add/update",
    example: [
      { locale: "th", name: "ขนาด" },
      { locale: "zh", name: "尺寸" },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseTranslationDto)
  translations: BaseTranslationDto[];
}

/**
 * DTO for updating customization option translations
 */
export class UpdateCustomizationOptionTranslationsDto {
  @ApiProperty({
    type: [BaseTranslationDto],
    description: "Array of translations to add/update",
    example: [
      { locale: "th", name: "ใหญ่" },
      { locale: "zh", name: "大" },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseTranslationDto)
  translations: BaseTranslationDto[];
}
