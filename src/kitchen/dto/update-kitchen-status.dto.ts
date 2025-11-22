import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

import { OrderStatus } from "src/generated/prisma/client";

/**
 * DTO for updating order kitchen status
 */
export class UpdateKitchenStatusDto {
  @ApiProperty({
    description: "New kitchen status",
    enum: OrderStatus,
    example: OrderStatus.PREPARING,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
