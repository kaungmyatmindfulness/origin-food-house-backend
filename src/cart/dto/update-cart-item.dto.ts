import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'Updated quantity',
    example: 3,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({
    description: 'Updated notes',
    example: 'Extra spicy',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
