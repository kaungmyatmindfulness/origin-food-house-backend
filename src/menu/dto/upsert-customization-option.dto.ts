// src/menu/dto/upsert-customization-option.dto.ts
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library'; // Or appropriate import if using custom Decimal type

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
    example: 2.5,
    type: Number,
    description:
      'Additional price for this option. Can be negative for discounts.',
  })
  @IsOptional()
  @IsNumber()
  additionalPrice?: number | Decimal; // Accept number, Prisma handles Decimal
}
