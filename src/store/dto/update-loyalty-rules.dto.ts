import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, IsInt, Min, Max } from 'class-validator';

export class UpdateLoyaltyRulesDto {
  @ApiProperty({
    description:
      'Points earned per currency unit (e.g., "0.1" = 1 point per 10 THB)',
    example: '0.1',
    pattern: '^\\d+(\\.\\d{1,4})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Point rate must be a valid decimal string',
  })
  pointRate: string;

  @ApiProperty({
    description:
      'Currency value per point for redemption (e.g., "0.1" = 100 points = 10 THB)',
    example: '0.1',
    pattern: '^\\d+(\\.\\d{1,4})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Redemption rate must be a valid decimal string',
  })
  redemptionRate: string;

  @ApiProperty({
    description: 'Number of days before loyalty points expire (0-3650)',
    example: 365,
    minimum: 0,
    maximum: 3650,
  })
  @IsInt()
  @Min(0, { message: 'Expiry days must be at least 0' })
  @Max(3650, { message: 'Expiry days must be at most 3650 (10 years)' })
  expiryDays: number;
}
