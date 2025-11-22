import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

import { OrderStatus } from "src/generated/prisma/client";

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: "New order status",
    enum: OrderStatus,
    example: OrderStatus.PREPARING,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
