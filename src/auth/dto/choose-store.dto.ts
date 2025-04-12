import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class ChooseStoreDto {
  @ApiProperty({
    example: 5,
    description: 'The ID (UUID) of the store the user wants to act under',
  })
  @IsUUID(7, { message: 'storeId must be a valid UUID string' })
  storeId: string;
}
