import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '@prisma/client';

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID' })
  id: string;

  @ApiProperty({ description: 'Store ID' })
  storeId: string;

  @ApiProperty({ description: 'Table ID' })
  tableId: string;

  @ApiProperty({ description: 'Session status', enum: SessionStatus })
  status: SessionStatus;

  @ApiProperty({ description: 'Number of guests' })
  guestCount: number;

  @ApiProperty({ description: 'Session token for authentication' })
  sessionToken: string;

  @ApiProperty({ description: 'Closed timestamp', nullable: true })
  closedAt: Date | null;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: Date;
}
