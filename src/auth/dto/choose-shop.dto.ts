import { ApiProperty } from '@nestjs/swagger';

export class ChooseShopDto {
  @ApiProperty({
    example: 1,
    description: 'The user’s ID, returned from the first login step',
  })
  userId: number;

  @ApiProperty({
    example: 5,
    description: 'The ID of the shop the user wants to act under',
  })
  shopId: number;
}
