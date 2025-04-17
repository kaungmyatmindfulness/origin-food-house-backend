import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class BatchCreateTableDto {
  @ApiProperty({
    description:
      'Display name or number for the table (must be unique within the batch and store)',
    example: 'New Table 1',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Table name cannot be empty.' })
  @IsString()
  @MaxLength(50)
  name: string;
}
