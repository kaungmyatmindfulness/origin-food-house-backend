import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { Decimal } from "src/common/types/decimal.type";

export class MenuItemNestedResponseDto {
  @ApiProperty({ example: 147 })
  id: string;

  @ApiProperty({ example: "Generic Granite Cheese" })
  name: string;

  @ApiPropertyOptional({
    example: "The lavender Bike combines...",
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({ type: String, example: "49.11", nullable: true })
  basePrice: Decimal | string | null;

  @ApiPropertyOptional({
    example: "uploads/abc-123-def",
    description: "Base S3 path",
    nullable: true,
  })
  imagePath: string | null;

  @ApiProperty({ example: 2 })
  sortOrder: number;
}
