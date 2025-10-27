import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateTaxAndServiceChargeDto {
  @ApiProperty({
    description: 'VAT rate as decimal string (e.g., "0.07" for 7%)',
    example: '0.07',
    pattern: '^\\d+(\\.\\d{1,4})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'VAT rate must be a valid decimal string',
  })
  vatRate: string;

  @ApiProperty({
    description: 'Service charge rate as decimal string (e.g., "0.10" for 10%)',
    example: '0.10',
    pattern: '^\\d+(\\.\\d{1,4})?$',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Service charge rate must be a valid decimal string',
  })
  serviceChargeRate: string;
}
