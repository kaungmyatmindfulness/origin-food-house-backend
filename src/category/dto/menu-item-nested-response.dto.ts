import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

import { TranslationWithDescriptionResponseDto } from "src/common/dto/translation.dto";

import { CustomizationGroupResponseDto } from "./customization-group-response.dto";

export class MenuItemNestedResponseDto {
  @ApiProperty({ example: "0194ca3b-xxxx-xxxx-xxxx-xxxxxxxxxxxx" })
  id: string;

  @ApiProperty({ example: "Pad Thai" })
  name: string;

  @ApiPropertyOptional({
    type: String,
    example: "Classic Thai stir-fried rice noodles",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    type: String,
    example: "49.11",
    description: "Base price, formatted as string.",
  })
  basePrice: string;

  @ApiPropertyOptional({
    type: String,
    example: "uploads/abc-123-def",
    description: "Base S3 path",
    nullable: true,
  })
  imagePath: string | null;

  @ApiProperty({ example: 2 })
  sortOrder: number;

  @ApiPropertyOptional({
    description: "Translations for the menu item in different locales.",
    type: () => [TranslationWithDescriptionResponseDto],
    example: [
      {
        locale: "en",
        name: "Pad Thai",
        description: "Classic Thai stir-fried rice noodles",
      },
      { locale: "th", name: "ผัดไทย", description: "ผัดไทยแบบดั้งเดิม" },
    ],
  })
  @Type(() => TranslationWithDescriptionResponseDto)
  translations?: TranslationWithDescriptionResponseDto[];

  @ApiPropertyOptional({
    description: "Customization groups for this menu item.",
    type: () => [CustomizationGroupResponseDto],
  })
  @Type(() => CustomizationGroupResponseDto)
  customizationGroups?: CustomizationGroupResponseDto[];
}
