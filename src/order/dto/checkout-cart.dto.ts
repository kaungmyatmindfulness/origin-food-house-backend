import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";

import { OrderType } from "src/generated/prisma/client";

export class CheckoutCartDto {
  @ApiProperty({
    description: "Order type",
    enum: OrderType,
    example: OrderType.DINE_IN,
    default: OrderType.DINE_IN,
  })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({
    description: "Table name (from session)",
    example: "Table 5",
    required: false,
  })
  @IsOptional()
  @IsString()
  tableName?: string;
}
