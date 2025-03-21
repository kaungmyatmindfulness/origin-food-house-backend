// src/order/order.controller.ts

import { Controller, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrderService } from './order.service';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post(':sessionId/chunk')
  @ApiOperation({ summary: 'Add a new chunk of items to the single order' })
  async addChunk(
    @Param('sessionId') sessionId: number,
    @Body()
    chunkData: {
      items: Array<{
        menuItemId: number;
        price: number;
        quantity: number;
        finalPrice?: number;
        variant?: any;
        size?: any;
        addOns?: any;
        notes?: string;
      }>;
    },
  ) {
    const chunk = await this.orderService.addChunk(sessionId, chunkData);
    return {
      status: 'success',
      data: chunk,
      message: 'New chunk created',
      error: null,
    };
  }

  @Patch('chunk/:chunkId/status')
  @ApiOperation({ summary: 'Update the status of an order chunk (KDS usage)' })
  async updateChunkStatus(
    @Param('chunkId') chunkId: number,
    @Body() body: { status: string },
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
  @ApiOperation({ summary: 'Pay the single order, auto-close the session' })
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
