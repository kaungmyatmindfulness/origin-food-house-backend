import { ApiProperty } from '@nestjs/swagger';

export class CategoryBasicResponseDto {
  @ApiProperty({ example: 6 })
  id: number;
  @ApiProperty({ example: 'Appetizers' })
  name: string;
  @ApiProperty({ example: 1 })
  storeId: number;
  @ApiProperty({ example: 1 })
  sortOrder: number;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}
