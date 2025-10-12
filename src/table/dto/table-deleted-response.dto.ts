import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class TableDeletedResponseDto {
  @ApiProperty({ format: 'uuid', description: 'ID of the deleted table.' })
  @Expose()
  id: string;
  @ApiProperty({
    description: 'Indicator that the deletion was successful.',
    example: true,
  })
  @Expose()
  deleted: boolean;
}
