import { ApiProperty } from '@nestjs/swagger';

export class StoreBasicInfoDto {
  @ApiProperty({ description: "Store's unique identifier", example: 1 })
  id: number;

  @ApiProperty({ description: "Store's name", example: 'Main Street Cafe' })
  name: string;
}
