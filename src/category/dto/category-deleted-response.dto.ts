import { ApiProperty } from '@nestjs/swagger';

export class CategoryDeletedResponseDto {
  @ApiProperty({ description: 'The ID of the deleted category.', example: 6 })
  id: number;
}
