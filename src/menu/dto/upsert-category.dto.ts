import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertCategoryDto {
  @ApiPropertyOptional({
    description:
      'ID of the option to update. Omit to create a new option within the group.',
    example: '018eb1ca-18e9-7634-8009-11d0e817b99f',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Provided ID must be a valid UUID' })
  id?: string; // Optional string ID for UUID

  @ApiProperty({ example: 'Main Dishes' })
  @IsString()
  name: string;
}
