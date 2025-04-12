import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpsertCustomizationOptionDto } from './upsert-customization-option.dto';

export class UpsertCustomizationGroupDto {
  @ApiPropertyOptional({
    description: 'ID of the existing group to update.',
    example: '018eb1ca-18e9-7634-8009-11d0e817b99f',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Provided ID must be a valid UUID' })
  id?: string;

  @ApiProperty({ example: 'Size' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Is selecting an option from this group mandatory?',
  })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description:
      'Minimum number of options required if group is required (usually 1 if required=true)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minSelectable?: number;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description:
      'Maximum number of options allowed (e.g., 1 for size, >1 for toppings)',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSelectable?: number;

  @ApiProperty({ type: [UpsertCustomizationOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCustomizationOptionDto)
  options: UpsertCustomizationOptionDto[];
}
