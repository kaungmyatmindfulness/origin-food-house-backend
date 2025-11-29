import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Split data for EVEN split type
 */
export class EvenSplitDataDto {
  @ApiProperty({
    description: "Number of guests to split the bill among",
    example: 3,
    minimum: 2,
  })
  guestCount: number;
}

/**
 * Split data for BY_ITEM split type
 */
export class ByItemSplitDataDto {
  @ApiProperty({
    type: "object",
    additionalProperties: {
      type: "array",
      items: { type: "string" },
    },
    description:
      "Item assignments by guest (e.g., { 'guest1': ['item-id-1', 'item-id-2'] })",
    example: {
      guest1: ["item-uuid-1", "item-uuid-2"],
      guest2: ["item-uuid-3"],
    },
  })
  itemAssignments: Record<string, string[]>;
}

/**
 * Split data for CUSTOM split type
 */
export class CustomSplitDataDto {
  @ApiProperty({
    type: [String],
    description: "Custom amounts for each guest (as decimal strings)",
    example: ["30.00", "45.00", "25.00"],
  })
  customAmounts: string[];
}

/**
 * Metadata stored with a split payment record
 */
export class SplitMetadataDto {
  @ApiPropertyOptional({
    description: "Number of guests for even split",
    example: 3,
  })
  guestCount?: number;

  @ApiPropertyOptional({
    description: "Amount per guest for even split",
    example: "33.33",
  })
  amountPerGuest?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: {
      type: "array",
      items: { type: "string" },
    },
    description: "Item assignments for BY_ITEM split",
    example: { guest1: ["item-id-1"] },
  })
  itemAssignments?: Record<string, string[]>;

  @ApiPropertyOptional({
    type: [String],
    description: "Assigned item IDs for this guest (BY_ITEM split)",
    example: ["item-uuid-1", "item-uuid-2"],
  })
  assignedItems?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: "Custom amounts for CUSTOM split",
    example: ["30.00", "45.00"],
  })
  customAmounts?: string[];

  @ApiPropertyOptional({
    description: "Total number of guests in the split",
    example: 3,
  })
  totalGuests?: number;

  @ApiPropertyOptional({
    description: "Grand total of the order",
    example: "100.00",
  })
  grandTotal?: string;

  @ApiPropertyOptional({
    description: "Remaining amount to be paid",
    example: "50.00",
  })
  remaining?: string;
}
