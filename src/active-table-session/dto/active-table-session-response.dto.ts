import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ActiveTableSessionResponseDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Unique ID of the active session record',
  })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid', description: 'ID of the associated table' })
  @Expose()
  tableId: string;

  @ApiProperty({ format: 'uuid', description: 'ID of the associated store' })
  @Expose()
  storeId: string;

  @ApiProperty({ description: 'Timestamp when the session started' })
  @Expose()
  createdAt: Date;
}
