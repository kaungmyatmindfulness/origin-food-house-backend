import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ChooseShopDto {
  @ApiProperty({
    example: 5,
    description: 'The ID of the shop the user wants to act under',
  })
  @IsInt()
  @Min(1)
  shopId: number;
}
