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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";

import { CalculateSplitDto } from "./dto/calculate-split.dto";
import { CreateRefundDto } from "./dto/create-refund.dto";
import {
  PaymentResponseDto,
  RefundResponseDto,
} from "./dto/payment-response.dto";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { RecordSplitPaymentDto } from "./dto/record-split-payment.dto";
import { PaymentService } from "./payment.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RequestWithUser } from "../auth/types";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Payments")
@Controller("payments")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("orders/:orderId")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Record payment for an order (POS)",
    description: "Record a payment and update order status if fully paid",
  })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 201,
    description: "Payment recorded successfully",
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid payment amount" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async recordPayment(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
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

  @Get("orders/:orderId")
  @ApiOperation({ summary: "Get all payments for an order" })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Payments retrieved successfully",
    type: [PaymentResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async findPaymentsByOrder(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
  ): Promise<StandardApiResponse<PaymentResponseDto[]>> {
    const userId = req.user.sub;
    const payments = await this.paymentService.findPaymentsByOrder(
      userId,
      orderId,
    );
    return StandardApiResponse.success(payments);
  }

  @Get("orders/:orderId/summary")
  @ApiOperation({ summary: "Get payment summary for an order" })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Payment summary retrieved successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async getPaymentSummary(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
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

  @Post("orders/:orderId/refunds")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create refund for an order (POS)",
    description: "Issue a refund for a paid order",
  })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 201,
    description: "Refund created successfully",
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid refund amount" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async createRefund(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
    @Body() dto: CreateRefundDto,
  ): Promise<StandardApiResponse<RefundResponseDto>> {
    const userId = req.user.sub;
    const refund = await this.paymentService.createRefund(userId, orderId, dto);
    return StandardApiResponse.success(refund);
  }

  @Get("orders/:orderId/refunds")
  @ApiOperation({ summary: "Get all refunds for an order" })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Refunds retrieved successfully",
    type: [RefundResponseDto],
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async findRefundsByOrder(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
  ): Promise<StandardApiResponse<RefundResponseDto[]>> {
    const userId = req.user.sub;
    const refunds = await this.paymentService.findRefundsByOrder(
      userId,
      orderId,
    );
    return StandardApiResponse.success(refunds);
  }

  @Post("orders/:orderId/calculate-split")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Calculate bill split amounts for an order",
    description:
      "Calculate how to split an order bill among guests (EVEN, BY_ITEM, or CUSTOM)",
  })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 200,
    description: "Split calculation completed successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid split data" })
  @ApiResponse({ status: 404, description: "Order not found" })
  async calculateSplit(
    @Param("orderId") orderId: string,
    @Body() dto: CalculateSplitDto,
  ): Promise<
    StandardApiResponse<{
      splits: { guestNumber: number; amount: string }[];
      remaining: string;
      alreadyPaid: string;
      grandTotal: string;
    }>
  > {
    const result = await this.paymentService.calculateSplitAmounts(
      orderId,
      dto.splitType,
      dto.splitData,
    );

    return StandardApiResponse.success({
      splits: result.splits.map((s) => ({
        guestNumber: s.guestNumber,
        amount: s.amount.toString(),
      })),
      remaining: result.remaining.toString(),
      alreadyPaid: result.alreadyPaid.toString(),
      grandTotal: result.grandTotal.toString(),
    });
  }

  @Post("orders/:orderId/split-payment")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Record a split payment for an order",
    description:
      "Record a split payment as part of a bill splitting transaction",
  })
  @ApiParam({ name: "orderId", description: "Order ID" })
  @ApiResponse({
    status: 201,
    description: "Split payment recorded successfully",
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid payment or overpayment" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Order not found" })
  async recordSplitPayment(
    @Req() req: RequestWithUser,
    @Param("orderId") orderId: string,
    @Body() dto: RecordSplitPaymentDto,
  ): Promise<StandardApiResponse<PaymentResponseDto>> {
    const userId = req.user.sub;
    const payment = await this.paymentService.recordSplitPayment(
      userId,
      orderId,
      dto,
    );
    return StandardApiResponse.success(payment);
  }
}
