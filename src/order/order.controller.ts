// src/order/order.controller.ts
import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderChunkDto } from './dto/create-order-chunk.dto';
import { UpdateChunkStatusDto } from './dto/update-chunk-status.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto'; // Import base response
import { Order, OrderChunk } from '@prisma/client'; // Import Prisma types for responses

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(private orderService: OrderService) {}

  @Post('session/:sessionId/chunk') // Changed route slightly for clarity
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a new order chunk with items to an open order for a session',
    description:
      'Finds or creates an OPEN order for the given session ID, then adds a new chunk with items and selected customizations.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The numeric ID (UUID) of the TableSession',
    type: Number,
  })
  @ApiResponse({
    status: 201, // Correct status code for creation
    description: 'New order chunk created successfully',
    type: StandardApiResponse<OrderChunk>, // Use generic type with OrderChunk
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data (e.g., empty items, invalid IDs)',
  })
  @ApiResponse({ status: 403, description: 'Session is closed' })
  @ApiResponse({ status: 404, description: 'Session or MenuItem not found' })
  async addChunk(
    @Param('sessionId', ParseIntPipe) sessionId: string, // Ensure ID is parsed as integer
    @Body() createOrderChunkDto: CreateOrderChunkDto,
  ): Promise<StandardApiResponse<OrderChunk>> {
    // Use correct return type
    const chunk = await this.orderService.addChunk(
      sessionId,
      createOrderChunkDto,
    );
    // Use the StandardApiResponse static helper for success
    return StandardApiResponse.success(chunk, 'New order chunk created');
  }

  @Patch('chunk/:chunkId/status')
  @ApiOperation({
    summary:
      'Update the status of an order chunk (e.g., for Kitchen Display System)',
  })
  @ApiParam({
    name: 'chunkId',
    description: 'The numeric ID (UUID) of the OrderChunk',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Order chunk status updated successfully',
    type: StandardApiResponse<OrderChunk>, // Use generic type
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status value or illegal transition',
  })
  @ApiResponse({ status: 404, description: 'Order Chunk not found' })
  async updateChunkStatus(
    @Param('chunkId', ParseIntPipe) chunkId: string, // Parse ID
    @Body() updateChunkStatusDto: UpdateChunkStatusDto,
  ): Promise<StandardApiResponse<OrderChunk>> {
    // Use correct return type
    const updatedChunk = await this.orderService.updateChunkStatus(
      chunkId,
      updateChunkStatusDto.status,
    );
    return StandardApiResponse.success(updatedChunk, 'Chunk status updated');
  }

  @Post('session/:sessionId/pay')
  @ApiOperation({
    summary:
      'Mark the open order for the session as PAID and close the session',
    description:
      'Finds the OPEN order for the session, marks it as PAID, and sets the TableSession status to CLOSED.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'The numeric ID (UUID) of the TableSession',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Order paid and session closed successfully',
    type: StandardApiResponse<Order>, // Use generic type with Order
  })
  @ApiResponse({
    status: 403,
    description: 'Session or Order already closed/paid',
  })
  @ApiResponse({
    status: 404,
    description: 'No open order found for the session',
  })
  async payOrder(
    @Param('sessionId', ParseIntPipe) sessionId: string, // Parse ID
  ): Promise<StandardApiResponse<Order>> {
    // Use correct return type
    const paidOrder = await this.orderService.payOrder(sessionId);
    return StandardApiResponse.success(paidOrder, 'Order paid, session closed');
  }
}
