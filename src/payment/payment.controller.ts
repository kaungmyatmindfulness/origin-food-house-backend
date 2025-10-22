import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import { CreateRefundDto } from './dto/create-refund.dto';
import {
  PaymentResponseDto,
  RefundResponseDto,
} from './dto/payment-response.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequestWithUser } from '../auth/types';
import { StandardApiResponse } from '../common/dto/standard-api-response.dto';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('orders/:orderId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record payment for an order (POS)',
    description: 'Record a payment and update order status if fully paid',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Payment recorded successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid payment amount' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async recordPayment(
    @Req() req: RequestWithUser,
    @Param('orderId') orderId: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<StandardApiResponse<PaymentResponseDto>> {
    const userId = req.user.sub;
    const payment = await this.paymentService.recordPayment(
      userId,
      orderId,
      dto,
    );
    return StandardApiResponse.success(payment);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Get all payments for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Payments retrieved successfully',
    type: [PaymentResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findPaymentsByOrder(
    @Req() req: RequestWithUser,
    @Param('orderId') orderId: string,
  ): Promise<StandardApiResponse<PaymentResponseDto[]>> {
    const userId = req.user.sub;
    const payments = await this.paymentService.findPaymentsByOrder(
      userId,
      orderId,
    );
    return StandardApiResponse.success(payments);
  }

  @Get('orders/:orderId/summary')
  @ApiOperation({ summary: 'Get payment summary for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Payment summary retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getPaymentSummary(
    @Req() req: RequestWithUser,
    @Param('orderId') orderId: string,
  ): Promise<
    StandardApiResponse<{
      grandTotal: string;
      totalPaid: string;
      totalRefunded: string;
      netPaid: string;
      remainingBalance: string;
      isFullyPaid: boolean;
    }>
  > {
    const userId = req.user.sub;
    const summary = await this.paymentService.getPaymentSummary(
      userId,
      orderId,
    );
    return StandardApiResponse.success({
      grandTotal: summary.grandTotal.toString(),
      totalPaid: summary.totalPaid.toString(),
      totalRefunded: summary.totalRefunded.toString(),
      netPaid: summary.netPaid.toString(),
      remainingBalance: summary.remainingBalance.toString(),
      isFullyPaid: summary.isFullyPaid,
    });
  }

  @Post('orders/:orderId/refunds')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create refund for an order (POS)',
    description: 'Issue a refund for a paid order',
  })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Refund created successfully',
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid refund amount' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async createRefund(
    @Req() req: RequestWithUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreateRefundDto,
  ): Promise<StandardApiResponse<RefundResponseDto>> {
    const userId = req.user.sub;
    const refund = await this.paymentService.createRefund(userId, orderId, dto);
    return StandardApiResponse.success(refund);
  }

  @Get('orders/:orderId/refunds')
  @ApiOperation({ summary: 'Get all refunds for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Refunds retrieved successfully',
    type: [RefundResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findRefundsByOrder(
    @Req() req: RequestWithUser,
    @Param('orderId') orderId: string,
  ): Promise<StandardApiResponse<RefundResponseDto[]>> {
    const userId = req.user.sub;
    const refunds = await this.paymentService.findRefundsByOrder(
      userId,
      orderId,
    );
    return StandardApiResponse.success(refunds);
  }
}
