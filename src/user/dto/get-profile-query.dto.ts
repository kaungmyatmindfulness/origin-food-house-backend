import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GetProfileQueryDto {
  @ApiPropertyOptional({
    description:
      'Optional: ID (UUID) of the store to get user context (e.g., role) for.',
    type: String,
    format: 'uuid',
    example: '018eb1b4-9183-7a94-b723-f7f5f5ddb0af',
  })
  @IsOptional()
  @IsUUID(7, { message: 'storeId must be a valid UUID string' })
  storeId?: string;
}
