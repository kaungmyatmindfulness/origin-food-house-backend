import { ApiProperty } from '@nestjs/swagger';

export class CategoryDeletedResponseDto {
  @ApiProperty({
    description: 'The ID (UUID) of the deleted category.',
    example: 6,
  })
  id: string;
}
