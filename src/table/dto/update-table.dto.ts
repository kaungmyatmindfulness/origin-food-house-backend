import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class UpdateTableDto {
  @ApiPropertyOptional({
    description:
      'New display name or number for the table (unique within the store)',
    example: 'Patio 5',
    maxLength: 50,
  })
  @IsOptional()
  @IsNotEmpty({ message: 'Table name cannot be empty if provided.' })
  @IsString()
  @MaxLength(50)
  name?: string;
}
