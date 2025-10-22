import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { IsPositiveNumericString } from '../../common/decorators/is-positive-numeric-string.decorator';

export class CreateRefundDto {
  @ApiProperty({
    description: 'Refund amount (as string for Decimal precision)',
    example: '50.00',
  })
  @IsPositiveNumericString()
  amount: string;

  @ApiProperty({
    description: 'Reason for refund',
    example: 'Item returned',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Staff member who processed the refund',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  refundedBy?: string;
}
