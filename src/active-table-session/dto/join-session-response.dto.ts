import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

// Simple response for the join endpoint (token is in cookie)
export class JoinSessionResponseDto {
  @ApiProperty({
    example: 'Session joined successfully. Session token set in cookie.',
  })
  @Expose()
  message: string;

  @ApiProperty({
    format: 'uuid',
    description: 'ID of the joined active session record',
  })
  @Expose()
  sessionId: string; // Return the session PK ID

  @ApiProperty({ format: 'uuid', description: 'ID of the associated table' })
  @Expose()
  tableId: string;

  @ApiProperty({ format: 'uuid', description: 'ID of the associated store' })
  @Expose()
  storeId: string;
}
