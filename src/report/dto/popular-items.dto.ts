import { ApiProperty } from "@nestjs/swagger";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * DTO for popular menu item
 */
export class PopularItemDto {
  @ApiProperty({
    description: "Menu item ID",
  })
  menuItemId: string;

  @ApiProperty({
    description: "Menu item name",
  })
  menuItemName: string;

  @ApiProperty({
    description: "Total quantity sold",
    example: 150,
  })
  quantitySold: number;

  @ApiProperty({
    description: "Total revenue from this item",
    type: String,
    example: "1500.00",
  })
  totalRevenue: Decimal;

  @ApiProperty({
    description: "Number of orders containing this item",
    example: 75,
  })
  orderCount: number;
}

/**
 * DTO for popular items report
 */
export class PopularItemsDto {
  @ApiProperty({
    description: "List of popular items",
    type: [PopularItemDto],
  })
  items: PopularItemDto[];

  @ApiProperty({
    description: "Date range start",
  })
  startDate: Date;

  @ApiProperty({
    description: "Date range end",
  })
  endDate: Date;
}
