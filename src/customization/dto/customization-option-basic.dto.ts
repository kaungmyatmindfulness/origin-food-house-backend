// src/customization/dto/customization-option-basic.dto.ts (Example - place in customization module ideally)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CustomizationOptionBasicDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id: string;
  @ApiProperty() @Expose() name: string;
  @ApiPropertyOptional({ type: Number, nullable: true })
  @Expose()
  @Type(() => Number)
  additionalPrice?: number | null;
}
