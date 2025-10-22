import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * DTO for sales summary report
 */
export class SalesSummaryDto {
  @ApiProperty({
    description: 'Total sales amount',
    type: String,
    example: '12500.00',
  })
  totalSales: Decimal;

  @ApiProperty({
    description: 'Total number of orders',
    example: 125,
  })
  orderCount: number;

  @ApiProperty({
    description: 'Average order value',
    type: String,
    example: '100.00',
  })
  averageOrderValue: Decimal;

  @ApiProperty({
    description: 'Total VAT collected',
    type: String,
    example: '875.00',
  })
  totalVat: Decimal;

  @ApiProperty({
    description: 'Total service charge collected',
    type: String,
    example: '0.00',
  })
  totalServiceCharge: Decimal;

  @ApiProperty({
    description: 'Date range start',
  })
  startDate: Date;

  @ApiProperty({
    description: 'Date range end',
  })
  endDate: Date;
}
