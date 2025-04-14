import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class StoreSettingResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Setting record ID' })
  id: string;
  @ApiProperty({ format: 'uuid', description: 'ID of the associated store' })
  storeId: string;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: 'Store currency code',
  })
  currency: Currency;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '0.07',
    description: 'VAT rate (e.g., 0.07 for 7%)',
  })
  vatRate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '0.10',
    description: 'Service charge rate (e.g., 0.10 for 10%)',
  })
  serviceChargeRate?: string | null;

  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
