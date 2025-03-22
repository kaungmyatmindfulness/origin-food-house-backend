import { Controller, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { ChunkStatus } from '@prisma/client';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post(':sessionId/chunk')
  @ApiOperation({ summary: 'Add a chunk with items to the single order' })
  async addChunk(
    @Param('sessionId') sessionId: number,
    @Body()
    body: {
      items: Array<{
        menuItemId: number;
        price: number;
        quantity: number;
        finalPrice?: number;
        chosenVariationId?: number;
        chosenSizeId?: number;
        chosenAddOns?: any;
        notes?: string;
      }>;
    },
  ) {
    const chunk = await this.orderService.addChunk(sessionId, body);
    return {
      status: 'success',
      data: chunk,
      message: 'New chunk created',
      error: null,
    };
  }

  @Patch('chunk/:chunkId/status')
  @ApiOperation({ summary: 'Update chunk status (KDS usage)' })
  async updateChunkStatus(
    @Param('chunkId') chunkId: number,
    @Body() body: { status: ChunkStatus },
  ) {
    const updated = await this.orderService.updateChunkStatus(
      chunkId,
      body.status,
    );
    return {
      status: 'success',
      data: updated,
      message: 'Chunk status updated',
      error: null,
    };
  }

  @Post(':sessionId/pay')
  @ApiOperation({ summary: 'Pay the single order, auto-close session' })
  async payOrder(@Param('sessionId') sessionId: number) {
    const paid = await this.orderService.payOrder(sessionId);
    return {
      status: 'success',
      data: paid,
      message: 'Order paid, session closed',
      error: null,
    };
  }
}
