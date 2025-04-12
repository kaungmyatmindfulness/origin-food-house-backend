import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ChooseStoreDto {
  @ApiProperty({
    example: 5,
    description: 'The ID of the store the user wants to act under',
  })
  @IsInt()
  @Min(1)
  storeId: string;
}
