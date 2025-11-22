import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import {
  TranslationMap,
  TranslationWithDescriptionResponseDto,
} from "src/common/dto/translation.dto";
import { RoutingArea } from "src/generated/prisma/client";

import { CategoryResponseDto } from "./category-response.dto";
import { CustomizationGroupResponseDto } from "./customization-group-response.dto";

export class MenuItemResponseDto {
  @ApiProperty({ example: 147 })
  id: string;

  @ApiProperty({
    example: "Generic Granite Cheese",
    description:
      "Item name (default/fallback). Use translations map for localized names.",
  })
  name: string;

  @ApiPropertyOptional({
    example: "The lavender Bike combines Bolivia aesthetics...",
    description:
      "Item description (default/fallback). Use translations map for localized descriptions.",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Base price, formatted as string.",
    example: "49.11",
    type: String,
    nullable: false,
  })
  basePrice: string;

  @ApiPropertyOptional({
    example: "uploads/abc-123-def",
    description:
      "Base S3 path for image. Frontend constructs URL: baseUrl + imagePath + '-' + size + '.webp'",
    nullable: true,
  })
  imagePath: string | null;

  @ApiProperty({
    description:
      "Indicates if the item is temporarily hidden (e.g., out of stock).",
    example: false,
  })
  isHidden: boolean;

  @ApiProperty({
    description: "Indicates if the item is currently out of stock.",
    example: false,
  })
  isOutOfStock: boolean;

  @ApiProperty({
    enum: RoutingArea,
    description: "Kitchen routing area for this item",
    example: RoutingArea.GRILL,
  })
  routingArea: RoutingArea;

  @ApiPropertyOptional({
    description: "Expected preparation time in minutes",
    example: 15,
    type: Number,
    nullable: true,
  })
  preparationTimeMinutes: number | null;

  @ApiProperty({ example: 6 })
  categoryId: string;

  @ApiProperty({ example: 1 })
  storeId: string;

  @ApiProperty({ example: 2 })
  sortOrder: number;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last update timestamp" })
  updatedAt: Date;

  @ApiProperty({ type: () => CategoryResponseDto })
  @Type(() => CategoryResponseDto)
  category: CategoryResponseDto;

  @ApiProperty({ type: () => [CustomizationGroupResponseDto] })
  @Type(() => CustomizationGroupResponseDto)
  customizationGroups: CustomizationGroupResponseDto[];

  @ApiPropertyOptional({
    description:
      "Translations map by locale (e.g., { 'en': {...}, 'th': {...} }). Use for multi-language support.",
    example: {
      en: {
        locale: "en",
        name: "Pad Thai",
        description: "Thai stir-fried noodles",
      },
      th: { locale: "th", name: "ผัดไทย", description: "ก๋วยเตี๋ยวผัดไทย" },
    },
    nullable: true,
  })
  translations?: TranslationMap<TranslationWithDescriptionResponseDto>;
}
