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
import { ApiTags, ApiParam, ApiQuery } from "@nestjs/swagger";

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
import {
  ApiAuth,
  ApiAuthWithRoles,
  ApiResourceErrors,
  ApiStandardErrors,
} from "../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Payments")
@Controller("payments")
@UseGuards(JwtAuthGuard)
@ApiAuth()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("orders/:orderId")
  @HttpCode(HttpStatus.CREATED)
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiSuccessResponse(PaymentResponseDto, {
    status: HttpStatus.CREATED,
    description: "Payment recorded successfully",
  })
  @ApiResourceErrors()
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
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiSuccessResponse(PaymentResponseDto, {
    isArray: true,
    description: "Payments retrieved successfully",
  })
  @ApiResourceErrors()
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
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiQuery({
    name: "summary",
    description: "Payment summary for the order",
    required: false,
  })
  @ApiResourceErrors()
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
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiSuccessResponse(RefundResponseDto, {
    status: HttpStatus.CREATED,
    description: "Refund created successfully",
  })
  @ApiResourceErrors()
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
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiSuccessResponse(RefundResponseDto, {
    isArray: true,
    description: "Refunds retrieved successfully",
  })
  @ApiResourceErrors()
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
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiStandardErrors()
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
  @ApiAuthWithRoles()
  @ApiParam({ name: "orderId", description: "Order ID", type: String })
  @ApiSuccessResponse(PaymentResponseDto, {
    status: HttpStatus.CREATED,
    description: "Split payment recorded successfully",
  })
  @ApiResourceErrors()
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
