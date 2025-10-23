import { ApiProperty } from '@nestjs/swagger';
import { TableStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTableStatusDto {
  @ApiProperty({
    description: 'New status for the table',
    enum: TableStatus,
    example: TableStatus.SEATED,
  })
  @IsNotEmpty()
  @IsEnum(TableStatus)
  status: TableStatus;
}
