import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { CheckoutCartDto } from './dto/checkout-cart.dto';
import { KdsQueryDto } from './dto/kds-query.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { StandardApiResponse } from '../common/dto/standard-api-response.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Checkout cart and create order (SOS)',
    description: 'Converts cart to order and clears the cart',
  })
  @ApiQuery({ name: 'sessionId', description: 'Active table session ID' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cart is empty or invalid' })
  @ApiResponse({ status: 404, description: 'Session or cart not found' })
  async checkout(
    @Query('sessionId') sessionId: string,
    @Body() dto: CheckoutCartDto,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.checkoutCart(sessionId, dto);
    return StandardApiResponse.success(order);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @Param('orderId') orderId: string,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.findOne(orderId);
    return StandardApiResponse.success(order);
  }

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get all orders for a session (SOS)' })
  @ApiParam({ name: 'sessionId', description: 'Active table session ID' })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: [OrderResponseDto],
  })
  async findBySession(
    @Param('sessionId') sessionId: string,
  ): Promise<StandardApiResponse<OrderResponseDto[]>> {
    const orders = await this.orderService.findBySession(sessionId);
    return StandardApiResponse.success(orders);
  }

  @Get('kds')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get orders for Kitchen Display System (KDS)',
    description:
      'Returns active kitchen orders with optional status filtering. Optimized for real-time kitchen operations.',
  })
  @ApiQuery({ name: 'storeId', description: 'Store ID', required: true })
  @ApiQuery({
    name: 'status',
    description: 'Filter by order status (defaults to active orders)',
    required: false,
    enum: ['PENDING', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'],
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-indexed)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (max 100)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'KDS orders retrieved successfully',
    type: PaginatedResponseDto<OrderResponseDto>,
  })
  async findForKds(
    @Query() queryDto: KdsQueryDto,
  ): Promise<StandardApiResponse<PaginatedResponseDto<OrderResponseDto>>> {
    const orders = await this.orderService.findForKds(queryDto);
    return StandardApiResponse.success(orders);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all orders for a store with pagination (POS)',
    description: 'Returns paginated list of orders for a specific store',
  })
  @ApiQuery({ name: 'storeId', description: 'Store ID', required: true })
  @ApiQuery({
    name: 'page',
    description: 'Page number (1-indexed)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (max 100)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: PaginatedResponseDto<OrderResponseDto>,
  })
  async findByStore(
    @Query('storeId') storeId: string,
    @Query() paginationDto: PaginationQueryDto,
  ): Promise<StandardApiResponse<PaginatedResponseDto<OrderResponseDto>>> {
    const orders = await this.orderService.findByStore(storeId, paginationDto);
    return StandardApiResponse.success(orders);
  }

  @Patch(':orderId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update order status (POS)',
    description: 'Update order status through kitchen workflow',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('orderId') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<StandardApiResponse<OrderResponseDto>> {
    const order = await this.orderService.updateStatus(orderId, dto);
    return StandardApiResponse.success(order);
  }
}
