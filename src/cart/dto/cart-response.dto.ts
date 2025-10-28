import { ApiProperty } from "@nestjs/swagger";
import { Decimal } from "@prisma/client/runtime/library";

export class CartItemCustomizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customizationOptionId: string;

  @ApiProperty()
  optionName: string;

  @ApiProperty({ type: String })
  additionalPrice: Decimal | null;
}

export class CartItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  menuItemId: string | null;

  @ApiProperty()
  menuItemName: string;

  @ApiProperty({ type: String })
  basePrice: Decimal;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty({ type: [CartItemCustomizationResponseDto] })
  customizations: CartItemCustomizationResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CartResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  sessionId: string;

  @ApiProperty()
  storeId: string;

  @ApiProperty({ type: String })
  subTotal: Decimal;

  @ApiProperty({ type: [CartItemResponseDto] })
  items: CartItemResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
