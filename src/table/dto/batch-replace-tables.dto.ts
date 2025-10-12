import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMaxSize } from 'class-validator'; // Removed ArrayMinSize(0) as empty is allowed implicitly

import { BatchCreateTableDto } from './batch-create-table.dto';

export class BatchReplaceTablesDto {
  @ApiProperty({
    description:
      'An array of table definitions that will replace ALL existing tables for the store. Send an empty array to delete all tables.',
    type: () => [BatchCreateTableDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(100, {
    message: 'Cannot process more than 100 tables in a single batch.',
  })
  @Type(() => BatchCreateTableDto)
  tables: BatchCreateTableDto[];
}
