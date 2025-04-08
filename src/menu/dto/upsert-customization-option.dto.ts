import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsPositiveNumericString } from 'src/common/decorators/is-positive-numeric-string.decorator';

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

  @ApiProperty({
    example: 9.5,
    type: Number,
    description: 'Base price before customizations',
  })
  @IsPositiveNumericString({
    message:
      'Base price must be a numeric string representing a value of 0.01 or greater',
  })
  additionalPrice: string;
}
