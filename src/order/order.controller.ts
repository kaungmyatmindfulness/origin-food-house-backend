import { Controller, Post, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderChunkDto } from './dto/create-order-chunk.dto';
import { UpdateChunkStatusDto } from './dto/update-chunk-status.dto';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post(':sessionId/chunk')
  @ApiOperation({
    summary: 'Add a new order chunk with multiple items to the single order',
  })
  @ApiResponse({
    status: 200,
    description: 'New order chunk created successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 12,
          orderId: 5,
          status: 'PENDING',
          createdAt: '2025-03-22T12:34:56.789Z',
          updatedAt: '2025-03-22T12:34:56.789Z',
          chunkItems: [
            {
              id: 101,
              menuItemId: 7,
              price: 4.99,
              quantity: 2,
              finalPrice: 9.98,
              chosenVariationId: 3,
              chosenSizeId: 2,
              chosenAddOns: null,
              notes: 'No salt',
              createdAt: '2025-03-22T12:34:56.789Z',
            },
          ],
        },
        message: 'New order chunk created',
        error: null,
      },
    },
  })
  async addChunk(
    @Param('sessionId') sessionId: number,
    @Body() createOrderChunkDto: CreateOrderChunkDto,
  ) {
    const chunk = await this.orderService.addChunk(
      sessionId,
      createOrderChunkDto,
    );
    return {
      status: 'success',
      data: chunk,
      message: 'New order chunk created',
      error: null,
    };
  }

  @Patch('chunk/:chunkId/status')
  @ApiOperation({
    summary: 'Update the status of an order chunk (for KDS usage)',
  })
  @ApiResponse({
    status: 200,
    description: 'Order chunk status updated successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 12,
          orderId: 5,
          status: 'IN_PROGRESS',
          createdAt: '2025-03-22T12:34:56.789Z',
          updatedAt: '2025-03-22T12:45:00.123Z',
          chunkItems: [
            /* ... */
          ],
        },
        message: 'Chunk status updated',
        error: null,
      },
    },
  })
  async updateChunkStatus(
    @Param('chunkId') chunkId: number,
    @Body() updateChunkStatusDto: UpdateChunkStatusDto,
  ) {
    const updated = await this.orderService.updateChunkStatus(
      chunkId,
      updateChunkStatusDto.status,
    );
    return {
      status: 'success',
      data: updated,
      message: 'Chunk status updated',
      error: null,
    };
  }

  @Post(':sessionId/pay')
  @ApiOperation({
    summary: 'Pay the single order for the session and auto-close the session',
  })
  @ApiResponse({
    status: 200,
    description: 'Order paid and session closed successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 5,
          tableSessionId: 10,
          status: 'PAID',
          createdAt: '2025-03-22T12:00:00.000Z',
          paidAt: '2025-03-22T12:50:00.000Z',
          chunks: [
            /* ... */
          ],
        },
        message: 'Order paid, session closed',
        error: null,
      },
    },
  })
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
