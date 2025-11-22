import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";

import { OrderStatus } from "src/generated/prisma/client";

import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

/**
 * Query parameters for Kitchen Display System (KDS) order filtering
 * Extends pagination with status filtering for active kitchen orders
 */
export class KdsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter by order status",
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: "Store ID (required)",
    example: "abc1234",
  })
  @IsString()
  storeId!: string;
}
