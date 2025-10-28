import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { SubscriptionService } from "src/subscription/services/subscription.service";

import { PlatformAdminGuard } from "../guards/platform-admin.guard";
import { AdminAuditInterceptor } from "../interceptors/admin-audit.interceptor";

interface GetPaymentQueueDto {
  page?: number;
  limit?: number;
  status?: string;
}

interface VerifyPaymentDto {
  note?: string;
}

interface RejectPaymentDto {
  reason: string;
}

@ApiTags("Admin - Payment Management")
@Controller("admin/payments")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
@ApiBearerAuth()
export class AdminPaymentController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({
    summary: "Get payment queue",
    description:
      "Get list of pending payment requests awaiting admin verification",
  })
  @ApiOkResponse({ description: "Payment queue retrieved successfully" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async getPaymentQueue(@Query() query: GetPaymentQueueDto): Promise<unknown> {
    return await this.subscriptionService.getPaymentQueue({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get payment detail",
    description: "Get detailed information for a specific payment request",
  })
  @ApiOkResponse({ description: "Payment detail retrieved successfully" })
  @ApiNotFoundResponse({ description: "Payment request not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async getPaymentDetail(@Param("id") id: string): Promise<unknown> {
    return await this.subscriptionService.getPaymentRequestDetail(id);
  }

  @Post(":id/verify")
  @ApiOperation({
    summary: "Verify payment",
    description: "Approve a pending payment request",
  })
  @ApiOkResponse({ description: "Payment verified successfully" })
  @ApiNotFoundResponse({ description: "Payment request not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async verifyPayment(
    @Param("id") id: string,
    @Body() dto: VerifyPaymentDto,
    @GetUser("sub") userId: string,
  ): Promise<unknown> {
    return await this.subscriptionService.verifyPaymentRequest(
      id,
      userId,
      dto.note,
    );
  }

  @Post(":id/reject")
  @ApiOperation({
    summary: "Reject payment",
    description: "Reject a pending payment request",
  })
  @ApiOkResponse({ description: "Payment rejected successfully" })
  @ApiNotFoundResponse({ description: "Payment request not found" })
  @ApiForbiddenResponse({ description: "Insufficient permissions" })
  async rejectPayment(
    @Param("id") id: string,
    @Body() dto: RejectPaymentDto,
    @GetUser("sub") userId: string,
  ): Promise<unknown> {
    return await this.subscriptionService.rejectPaymentRequest(
      id,
      userId,
      dto.reason,
    );
  }
}
