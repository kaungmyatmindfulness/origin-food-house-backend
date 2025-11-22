import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";

import { PaymentStatus } from "src/generated/prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import { RejectPaymentDto } from "../dto/reject-payment.dto";
import { VerifyPaymentDto } from "../dto/verify-payment.dto";
import { PaymentProofService } from "../services/payment-proof.service";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Admin - Payment Verification")
@Controller("admin/payment-requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AdminVerificationController {
  private readonly logger = new Logger(AdminVerificationController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentProofService: PaymentProofService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get payment requests queue (PLATFORM_ADMIN only)" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: PaymentStatus,
    description: "Filter by payment status",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  @ApiSuccessResponse(Object, {
    description: "Payment requests queue retrieved successfully",
  })
  async getPaymentQueue(
    @GetUser("sub") adminId: string,
    @Query("status") status?: PaymentStatus,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getPaymentQueue.name;
    this.logger.log(
      `[${method}] Admin ${adminId} fetching payment queue (status: ${status}, page: ${page}, limit: ${limit})`,
    );

    await this.subscriptionService.checkPlatformAdmin(adminId);

    const queue = await this.subscriptionService.getPaymentQueue({
      status,
      page,
      limit,
    });

    return StandardApiResponse.success(
      queue,
      "Payment queue retrieved successfully",
    );
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get payment request detail (PLATFORM_ADMIN only)" })
  @ApiParam({ name: "id", description: "Payment request ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment request detail retrieved successfully",
  })
  async getPaymentRequestDetail(
    @GetUser("sub") adminId: string,
    @Param("id") paymentRequestId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getPaymentRequestDetail.name;
    this.logger.log(
      `[${method}] Admin ${adminId} fetching payment request detail ${paymentRequestId}`,
    );

    await this.subscriptionService.checkPlatformAdmin(adminId);

    const detail =
      await this.subscriptionService.getPaymentRequestDetail(paymentRequestId);

    return StandardApiResponse.success(
      detail,
      "Payment request detail retrieved successfully",
    );
  }

  @Get(":id/payment-proof")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get payment proof presigned URL (PLATFORM_ADMIN only)",
  })
  @ApiParam({ name: "id", description: "Payment request ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment proof URL retrieved successfully",
  })
  async getPaymentProof(
    @GetUser("sub") adminId: string,
    @Param("id") paymentRequestId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getPaymentProof.name;
    this.logger.log(
      `[${method}] Admin ${adminId} fetching payment proof for request ${paymentRequestId}`,
    );

    await this.subscriptionService.checkPlatformAdmin(adminId);

    const presignedUrl =
      await this.paymentProofService.getPaymentProofUrl(paymentRequestId);

    return StandardApiResponse.success(
      { presignedUrl },
      "Payment proof URL retrieved successfully",
    );
  }

  @Post(":id/verify")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Approve payment request (PLATFORM_ADMIN only)" })
  @ApiParam({ name: "id", description: "Payment request ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment verified successfully",
  })
  async verifyPayment(
    @GetUser("sub") adminId: string,
    @Param("id") paymentRequestId: string,
    @Body() dto: VerifyPaymentDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.verifyPayment.name;
    this.logger.log(
      `[${method}] Admin ${adminId} verifying payment request ${paymentRequestId}`,
    );

    await this.subscriptionService.checkPlatformAdmin(adminId);

    await this.subscriptionService.verifyPaymentRequest(
      adminId,
      paymentRequestId,
      dto.notes,
    );

    return StandardApiResponse.success(
      null,
      "Payment verified and subscription activated successfully",
    );
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reject payment request (PLATFORM_ADMIN only)" })
  @ApiParam({ name: "id", description: "Payment request ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment rejected successfully",
  })
  async rejectPayment(
    @GetUser("sub") adminId: string,
    @Param("id") paymentRequestId: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.rejectPayment.name;
    this.logger.log(
      `[${method}] Admin ${adminId} rejecting payment request ${paymentRequestId}`,
    );

    await this.subscriptionService.checkPlatformAdmin(adminId);

    await this.subscriptionService.rejectPaymentRequest(
      adminId,
      paymentRequestId,
      dto.rejectionReason,
    );

    return StandardApiResponse.success(null, "Payment rejected successfully");
  }

  @Get("metrics/dashboard")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get admin dashboard metrics (PLATFORM_ADMIN only)",
  })
  @ApiSuccessResponse(Object, {
    description: "Dashboard metrics retrieved successfully",
  })
  async getAdminMetrics(
    @GetUser("sub") adminId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getAdminMetrics.name;
    this.logger.log(`[${method}] Admin ${adminId} fetching dashboard metrics`);

    await this.subscriptionService.checkPlatformAdmin(adminId);

    const metrics = await this.subscriptionService.getAdminMetrics();

    return StandardApiResponse.success(
      metrics,
      "Dashboard metrics retrieved successfully",
    );
  }
}
