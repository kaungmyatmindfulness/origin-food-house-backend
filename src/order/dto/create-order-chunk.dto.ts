// src/order/dto/create-order-chunk.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateOrderChunkItemDto } from './create-order-chunk-item.dto'; // Import item DTO

export class CreateOrderChunkDto {
  @ApiProperty({
    description: 'Array of items to add in this chunk.',
    type: () => [CreateOrderChunkItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order chunk must contain at least one item.' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderChunkItemDto)
  items: CreateOrderChunkItemDto[];
}
