import { ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

import {
  IsEnum,
  IsNumberString,
  IsOptional,
  Matches,
  ValidateIf,
} from 'class-validator';
import { IsNonNegativeNumericString } from 'src/common/decorators/is-non-negative-numeric-string.decorator';

export class UpdateStoreSettingDto {
  @ApiPropertyOptional({
    enum: Currency,
    example: Currency.THB,
    description: 'Update the default currency for the store.',
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'Invalid currency code provided.' })
  currency?: Currency;

  @ApiPropertyOptional({
    description:
      'Update the VAT rate. Send as a string (e.g., "0.07" for 7%, "0.125" for 12.5%). Send null or omit to remove/keep unchanged. Must be between "0.000" and "0.999".',
    type: String,
    pattern: '^0(?:\\.\\d{1,3})?$',
    example: '0.07',
    nullable: true,
  })
  @IsNonNegativeNumericString({
    message: 'VAT rate must be a valid numeric string (e.g., "0.07").',
  })
  vatRate?: string | null;

  @ApiPropertyOptional({
    description:
      'Update the Service Charge rate. Send as a string (e.g., "0.10" for 10%). Send null or omit to remove/keep unchanged. Must be between "0.000" and "0.999".',
    type: String,
    pattern: '^0(?:\\.\\d{1,3})?$',
    example: '0.10',
    nullable: true,
  })
  @IsNonNegativeNumericString({
    message:
      'Service charge rate must be a valid numeric string (e.g., "0.10").',
  })
  serviceChargeRate?: string | null;
}
