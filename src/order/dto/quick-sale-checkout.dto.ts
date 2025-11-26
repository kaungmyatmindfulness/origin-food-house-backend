import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

import { OrderType, SessionType } from "src/generated/prisma/client";

/**
 * DTO for individual items in a quick sale checkout
 */
export class QuickSaleItemDto {
  @ApiProperty({
    description: "Menu item ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID()
  menuItemId: string;

  @ApiProperty({
    description: "Quantity of the item",
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: "Array of customization option IDs",
    example: ["550e8400-e29b-41d4-a716-446655440001"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(7, { each: true })
  customizationOptionIds?: string[];

  @ApiPropertyOptional({
    description: "Notes for the item",
    example: "No onions",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * DTO for quick sale checkout - creates session and order in a single atomic operation
 *
 * This endpoint combines:
 * 1. Manual session creation
 * 2. Cart item addition
 * 3. Order checkout
 *
 * Into a single API call for faster quick sale processing.
 */
export class QuickSaleCheckoutDto {
  @ApiProperty({
    description: "Store ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID()
  storeId: string;

  @ApiProperty({
    description: "Session type (COUNTER, PHONE, or TAKEOUT - not TABLE)",
    enum: [SessionType.COUNTER, SessionType.PHONE, SessionType.TAKEOUT],
    example: SessionType.COUNTER,
  })
  @IsEnum(SessionType)
  sessionType: SessionType;

  @ApiProperty({
    description: "Order type",
    enum: OrderType,
    example: OrderType.DINE_IN,
  })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({
    description: "Array of items to checkout",
    type: [QuickSaleItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => QuickSaleItemDto)
  items: QuickSaleItemDto[];

  @ApiPropertyOptional({
    description: "Customer name (optional, useful for phone/takeout orders)",
    example: "John Doe",
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    description: "Customer phone number (optional, useful for phone orders)",
    example: "+1234567890",
  })
  @IsOptional()
  @IsString()
  customerPhone?: string;

  @ApiPropertyOptional({
    description: "Notes for the entire order",
    example: "Rush order",
  })
  @IsOptional()
  @IsString()
  orderNotes?: string;
}
