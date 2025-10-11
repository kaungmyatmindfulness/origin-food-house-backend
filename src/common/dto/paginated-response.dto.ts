import { ApiProperty } from '@nestjs/swagger';

/**
 * Metadata for paginated responses
 */
export class PaginationMeta {
  @ApiProperty({ description: 'Total number of items', example: 100 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  hasPrev: boolean;

  constructor(total: number, page: number, limit: number) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}

/**
 * Generic paginated response wrapper
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items' })
  items: T[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMeta })
  meta: PaginationMeta;

  constructor(items: T[], meta: PaginationMeta) {
    this.items = items;
    this.meta = meta;
  }

  /**
   * Create a paginated response
   */
  static create<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const meta = new PaginationMeta(total, page, limit);
    return new PaginatedResponseDto(items, meta);
  }
}
