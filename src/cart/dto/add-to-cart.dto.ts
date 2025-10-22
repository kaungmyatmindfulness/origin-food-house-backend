import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CartItemCustomizationDto {
  @ApiProperty({
    description: 'Customization option ID',
    example: '01234567',
  })
  @IsUUID()
  customizationOptionId: string;
}

export class AddToCartDto {
  @ApiProperty({
    description: 'Menu item ID to add to cart',
    example: '01234567',
  })
  @IsUUID()
  menuItemId: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Special instructions or notes',
    example: 'No onions please',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Selected customization options',
    type: [CartItemCustomizationDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemCustomizationDto)
  customizations?: CartItemCustomizationDto[];
}
