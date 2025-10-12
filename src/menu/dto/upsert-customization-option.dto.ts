import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID } from 'class-validator';

import { IsNonNegativeNumericString } from 'src/common/decorators/is-non-negative-numeric-string.decorator';

export class UpsertCustomizationOptionDto {
  @ApiPropertyOptional({
    description:
      'ID (UUID) of the option to update. Omit to create a new option within the group.',
    example: '018eb1ca-18e9-7634-8009-11d0e817b99f',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID(7, { message: 'Provided ID must be a valid UUID' })
  id?: string;

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
