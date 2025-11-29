import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  IsNotEmpty,
} from "class-validator";

import { IsPositiveNumericString } from "src/common/decorators/is-positive-numeric-string.decorator";
import { IsImagePath } from "src/common/validators/is-image-path.validator";
import { RoutingArea } from "src/generated/prisma/client";

import { UpsertCategoryDto } from "./upsert-category.dto";
import { UpsertCustomizationGroupDto } from "./upsert-customization-group.dto";

export class CreateMenuItemDto {
  @ApiProperty({ example: "Pad Krapow Moo" })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    example: "Stir-fried minced pork with holy basil, served with rice.",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  description?: string;

  @ApiProperty({
    example: 9.5,
    type: String,
    description: "Base price before customizations",
  })
  @IsPositiveNumericString({
    message:
      "Base price must be a numeric string representing a value of 0.01 or greater",
  })
  basePrice: string;

  @ApiPropertyOptional({
    example: "uploads/abc-123-def-456",
    description:
      "Base S3 path for the menu item image (without version suffix). Frontend constructs URLs as: baseUrl + imagePath + '-' + size + '.webp'",
  })
  @IsOptional()
  @IsString()
  @IsImagePath()
  imagePath?: string;

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
      "Kitchen routing area for this item (e.g., GRILL, FRY, DRINKS). Defaults to OTHER.",
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

  @ApiProperty({
    type: UpsertCategoryDto,
    description:
      "Category for the item. Provide ID to link/update existing, or just name to create new.",
  })
  @ValidateNested()
  @Type(() => UpsertCategoryDto)
  category: UpsertCategoryDto;

  @ApiPropertyOptional({
    type: [UpsertCustomizationGroupDto],
    description:
      "Optional customization groups (e.g., Size, Spice Level, Add-ons). Omit IDs for new groups/options.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCustomizationGroupDto)
  customizationGroups?: UpsertCustomizationGroupDto[];
}
