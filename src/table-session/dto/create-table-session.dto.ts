import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateTableSessionDto {
  @ApiProperty({ example: 1, description: 'ID of the store' })
  @IsInt()
  storeId: string;

  @ApiProperty({ example: 2, description: 'ID of the restaurant table' })
  @IsInt()
  tableId: string;
}
