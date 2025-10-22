import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * DTO for updating order kitchen status
 */
export class UpdateKitchenStatusDto {
  @ApiProperty({
    description: 'New kitchen status',
    enum: OrderStatus,
    example: OrderStatus.PREPARING,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
