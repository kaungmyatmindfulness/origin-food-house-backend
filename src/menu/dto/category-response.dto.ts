import { ApiProperty } from "@nestjs/swagger";

export class CategoryResponseDto {
  @ApiProperty({ example: 6 })
  id: string;

  @ApiProperty({ example: "Books" })
  name: string;

  @ApiProperty({ example: 1 })
  storeId: string;

  @ApiProperty({ example: 1 })
  sortOrder: number;

  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}
