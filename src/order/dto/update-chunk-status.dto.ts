import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ChunkStatus } from '@prisma/client';

export class UpdateChunkStatusDto {
  @ApiProperty({
    example: ChunkStatus.IN_PROGRESS,
    description: 'New status for the order chunk',
    enum: ChunkStatus,
  })
  @IsEnum(ChunkStatus)
  status: ChunkStatus;
}
