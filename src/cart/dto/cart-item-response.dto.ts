// src/cart/dto/cart-item-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
// Adjust import paths as needed
import { MenuItemBasicResponseDto } from '../../menu/dto/menu-item-basic-response.dto';
import { CustomizationOptionResponseDto } from '../../menu/dto/customization-option-response.dto';

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  cartId: string;

  @ApiProperty()
  @Expose()
  quantity: number;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  notes?: string | null;

  @ApiPropertyOptional({ type: () => MenuItemBasicResponseDto, nullable: true })
  @Expose()
  @Type(() => MenuItemBasicResponseDto)
  menuItem?: MenuItemBasicResponseDto | null;

  @ApiPropertyOptional({ type: () => [CustomizationOptionResponseDto] })
  @Expose()
  @Type(() => CustomizationOptionResponseDto)
  selectedOptions?: CustomizationOptionResponseDto[];

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}
