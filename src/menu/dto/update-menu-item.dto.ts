import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RoutingArea } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
  IsInt,
  Min,
} from "class-validator";

import { IsPositiveNumericString } from "src/common/decorators/is-positive-numeric-string.decorator";

import { UpsertCategoryDto } from "./upsert-category.dto";
import { UpsertCustomizationGroupDto } from "./upsert-customization-group.dto";

export class UpdateMenuItemDto {
  @ApiPropertyOptional({ example: "Pad Krapow Moo Kai Dao" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example:
      "Stir-fried minced pork with holy basil, served with rice and fried egg.",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 9.5,
    type: Number,
    description: "Base price before customizations",
  })
  @IsPositiveNumericString({
    message:
      "Base price must be a numeric string representing a value of 0.01 or greater",
  })
  basePrice: string;

  @ApiPropertyOptional({
    example: "images/krapow-pork-egg.jpg",
    description: "Key for image stored in S3 or similar",
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      "Set to true to temporarily hide the item (e.g., out of stock). Defaults to false (visible).",
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({
    enum: RoutingArea,
    description:
      "Kitchen routing area for this item (e.g., GRILL, FRY, DRINKS).",
    example: RoutingArea.GRILL,
  })
  @IsOptional()
  @IsEnum(RoutingArea, {
    message: "routingArea must be a valid RoutingArea enum value",
  })
  routingArea?: RoutingArea;

  @ApiPropertyOptional({
    description: "Expected preparation time in minutes",
    example: 15,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: "preparationTimeMinutes must be at least 1 minute" })
  preparationTimeMinutes?: number;

  @ApiPropertyOptional({
    type: UpsertCategoryDto,
    description:
      "Optional: Update or change category. Provide ID to link/update existing, or just name to create new.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpsertCategoryDto)
  category?: UpsertCategoryDto;

  @ApiPropertyOptional({
    type: [UpsertCustomizationGroupDto],
    description:
      "Optional: Full list of desired customization groups. Provide IDs to update existing groups/options. Groups/options missing IDs will be created. Existing groups/options NOT included in this array (by ID) WILL BE DELETED.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCustomizationGroupDto)
  customizationGroups?: UpsertCustomizationGroupDto[];
}
