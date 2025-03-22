import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderChunkItemDto } from './order-chunk-item.dto';

export class CreateOrderChunkDto {
  @ApiProperty({
    type: [OrderChunkItemDto],
    description:
      'List of order chunk items (each represents a group of menu items with selections)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderChunkItemDto)
  items: OrderChunkItemDto[];
}
