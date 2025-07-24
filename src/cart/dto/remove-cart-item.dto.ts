// src/cart/dto/remove-cart-item.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveCartItemDto {
  @ApiProperty({
    description: 'ID (UUID) of the CartItem to remove.',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('all')
  cartItemId: string;
}
