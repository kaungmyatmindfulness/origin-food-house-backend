import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID } from 'class-validator';

export class CreateTableSessionDto {
  @ApiProperty({ example: 1, description: 'ID (UUID) of the store' })
  @IsUUID(7, { message: 'storeId must be a valid UUID string' })
  storeId: string;

  @ApiProperty({ example: 2, description: 'ID (UUID) of the restaurant table' })
  @IsUUID(7, { message: 'tableId must be a valid UUID string' })
  tableId: string;
}
