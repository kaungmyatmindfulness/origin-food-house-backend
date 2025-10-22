import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

/**
 * DTO for order status count
 */
export class OrderStatusCountDto {
  @ApiProperty({
    description: 'Order status',
    enum: OrderStatus,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Number of orders with this status',
    example: 25,
  })
  count: number;

  @ApiProperty({
    description: 'Percentage of total orders',
    type: 'number',
    example: 20.5,
  })
  percentage: number;
}

/**
 * DTO for order status distribution report
 */
export class OrderStatusReportDto {
  @ApiProperty({
    description: 'Order status distribution',
    type: [OrderStatusCountDto],
  })
  statusDistribution: OrderStatusCountDto[];

  @ApiProperty({
    description: 'Total number of orders',
    example: 125,
  })
  totalOrders: number;

  @ApiProperty({
    description: 'Date range start',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Date range end',
  })
  endDate: Date;
}
