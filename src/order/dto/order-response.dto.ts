import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, OrderType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class OrderItemCustomizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  customizationOptionId: string;

  @ApiProperty({ type: String, nullable: true })
  finalPrice: Decimal | null;
}

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  menuItemId: string | null;

  @ApiProperty({ type: String })
  price: Decimal;

  @ApiProperty()
  quantity: number;

  @ApiProperty({ type: String, nullable: true })
  finalPrice: Decimal | null;

  @ApiProperty({ nullable: true })
  notes: string | null;

  @ApiProperty({ type: [OrderItemCustomizationResponseDto] })
  customizations: OrderItemCustomizationResponseDto[];
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty()
  storeId: string;

  @ApiProperty({ nullable: true })
  sessionId: string | null;

  @ApiProperty()
  tableName: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: OrderType })
  orderType: OrderType;

  @ApiProperty({ nullable: true })
  paidAt: Date | null;

  @ApiProperty({ type: String })
  subTotal: Decimal;

  @ApiProperty({ type: String, nullable: true })
  vatRateSnapshot: Decimal | null;

  @ApiProperty({ type: String, nullable: true })
  serviceChargeRateSnapshot: Decimal | null;

  @ApiProperty({ type: String })
  vatAmount: Decimal;

  @ApiProperty({ type: String })
  serviceChargeAmount: Decimal;

  @ApiProperty({ type: String })
  grandTotal: Decimal;

  @ApiProperty({ type: [OrderItemResponseDto] })
  orderItems: OrderItemResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
