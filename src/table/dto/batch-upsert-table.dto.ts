import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

import { UpsertTableDto } from './upsert-table.dto';

export class BatchUpsertTableDto {
  @ApiProperty({
    description:
      'An array of table objects to create or update. Any existing tables for the store NOT included in this list (by ID) will be deleted.',
    type: () => [UpsertTableDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100, {
    message: 'Cannot process more than 100 tables in a single batch.',
  })
  @Type(() => UpsertTableDto)
  tables: UpsertTableDto[];
}
