import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ChunkStatus } from '@prisma/client'; // Import the enum from Prisma Client

export class UpdateChunkStatusDto {
  @ApiProperty({
    description: 'The new status for the order chunk',
    enum: ChunkStatus, // Use the Prisma enum for validation and Swagger
    example: ChunkStatus.IN_PROGRESS,
  })
  @IsEnum(ChunkStatus)
  status: ChunkStatus;
}
