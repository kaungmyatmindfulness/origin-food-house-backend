import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import { BaseTranslationResponseDto } from "src/common/dto/translation.dto";

import { MenuItemNestedResponseDto } from "./menu-item-nested-response.dto";

/**
 * Represents a Category including its associated MenuItems for API responses.
 */
export class CategoryResponseDto {
  @ApiProperty({
    description: "Unique identifier for the category.",
    example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  })
  id: string;

  @ApiProperty({ description: "Name of the category.", example: "Appetizers" })
  name: string;

  @ApiProperty({
    description: "ID (UUID) of the store this category belongs to.",
    example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  })
  storeId: string;

  @ApiProperty({
    description: "Sort order of the category within the store.",
    example: 1,
  })
  sortOrder: number;

  @ApiPropertyOptional({
    description: "Translations for the category name in different locales.",
    type: () => [BaseTranslationResponseDto],
    example: [
      { locale: "en", name: "Appetizers" },
      { locale: "th", name: "อาหารเรียกน้ำย่อย" },
    ],
  })
  @Type(() => BaseTranslationResponseDto)
  translations?: BaseTranslationResponseDto[];

  @ApiProperty({ description: "Timestamp when the category was created." })
  createdAt: Date;

  @ApiProperty({ description: "Timestamp when the category was last updated." })
  updatedAt: Date;

  @ApiProperty({
    description:
      "Menu items belonging to this category, ordered by their sortOrder.",
    type: () => [MenuItemNestedResponseDto],
  })
  @Type(() => MenuItemNestedResponseDto)
  menuItems: MenuItemNestedResponseDto[];
}
