import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

import { CartItemResponseDto } from 'src/cart/dto/cart-item-response.dto';

export class CartResponseDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id: string;
  @ApiProperty({ format: 'uuid' }) @Expose() activeTableSessionId: string;
  @ApiProperty({ type: () => [CartItemResponseDto] })
  @Expose()
  @Type(() => CartItemResponseDto)
  items: CartItemResponseDto[];
  @ApiProperty() @Expose() createdAt: Date;
  @ApiProperty() @Expose() updatedAt: Date;
}
