import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Reusable pagination query DTO for all paginated endpoints
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Calculate the skip value for Prisma queries
   */
  get skip(): number {
    const page = this.page ?? 1;
    const limit = this.limit ?? 20;
    return (page - 1) * limit;
  }

  /**
   * Get the take value for Prisma queries
   */
  get take(): number {
    return this.limit ?? 20;
  }
}
