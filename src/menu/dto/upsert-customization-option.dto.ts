import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNonNegativeNumericString } from 'src/common/decorators/is-non-negative-numeric-string.decorator';

export class UpsertCustomizationOptionDto {
  @ApiPropertyOptional({
    example: 101,
    description: 'ID of existing option to update',
  })
  @IsOptional()
  @IsNumber()
  id?: number;

  @ApiProperty({ example: 'Large' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description:
      'Optional: Additional price for this option. Must be zero or positive. Send as string (e.g., "1.50", "0", "0.00"). Defaults to 0 if omitted.',
    type: String,
    example: '1.50',
    default: '0.00',
    nullable: true,
  })
  @IsOptional()
  @IsNonNegativeNumericString()
  additionalPrice?: string;
}
