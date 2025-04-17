import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateTableDto {
  @ApiProperty({
    description:
      'Display name or number for the table (unique within the store)',
    example: 'Table 10',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Table name cannot be empty.' })
  @IsString()
  @MaxLength(50)
  name: string;
}
