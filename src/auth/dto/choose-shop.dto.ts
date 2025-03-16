import { ApiProperty } from '@nestjs/swagger';

export class ChooseShopDto {
  @ApiProperty({
    example: 5,
    description: 'The ID of the shop the user wants to act under',
  })
  shopId: number;
}
