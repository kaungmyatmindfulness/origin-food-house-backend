import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class BatchOperationResponseDto {
  @ApiProperty({
    description: 'Number of records affected (e.g., created or deleted).',
    example: 15,
  })
  @Expose()
  count: number;
}
