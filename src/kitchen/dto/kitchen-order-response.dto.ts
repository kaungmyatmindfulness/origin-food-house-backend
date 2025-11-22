import { ApiProperty } from "@nestjs/swagger";

import { Decimal } from "src/common/types/decimal.type";
import {
  OrderStatus,
  OrderType,
  RoutingArea,
} from "src/generated/prisma/client";

/**
 * DTO for kitchen order display
 * Simplified view for Kitchen Display System (KDS)
 */
export class KitchenOrderResponseDto {
  @ApiProperty({ description: "Order ID" })
  id: string;

  @ApiProperty({ description: "Store ID" })
  storeId: string;

  @ApiProperty({ description: "Order number" })
  orderNumber: string;

  @ApiProperty({ description: "Table name" })
  tableName: string;

  @ApiProperty({ description: "Order type", enum: OrderType })
  orderType: OrderType;

  @ApiProperty({ description: "Order status", enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ description: "Grand total", type: String })
  grandTotal: Decimal;

  @ApiProperty({ description: "Order created timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Order updated timestamp" })
  updatedAt: Date;

  @ApiProperty({ description: "Order items", type: "array" })
  orderItems: Array<{
    id: string;
    menuItemId: string;
    quantity: number;
    notes?: string | null;
    menuItem?: {
      name: string;
      description?: string | null;
      routingArea?: RoutingArea;
      preparationTimeMinutes?: number | null;
    };
    customizations?: Array<{
      customizationOption?: {
        name: string;
      };
    }>;
  }>;
}
