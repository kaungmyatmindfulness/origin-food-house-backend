import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class GetProfileQueryDto {
  @ApiPropertyOptional({
    description:
      'Optional: ID of the store to get user context (e.g., role) for.',
    type: Number,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'storeId must be an integer' })
  @Min(1, { message: 'storeId must be a positive integer' })
  storeId?: number;
}
