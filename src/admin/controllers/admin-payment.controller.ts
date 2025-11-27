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
import { ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import {
  ApiAuthWithRoles,
  ApiGetAll,
  ApiGetOneAuth,
  ApiAction,
} from "src/common/decorators/api-crud.decorator";
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

// Placeholder response class for untyped responses
class PaymentResponseDto {}
class PaymentDetailResponseDto {}
class PaymentActionResponseDto {}

@ApiTags("Admin - Payment Management")
@Controller("admin/payments")
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminPaymentController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiAuthWithRoles()
  @ApiGetAll(PaymentResponseDto, "payment requests", {
    summary: "Get payment queue",
    description: "Payment queue retrieved successfully",
  })
  async getPaymentQueue(@Query() query: GetPaymentQueueDto): Promise<unknown> {
    return await this.subscriptionService.getPaymentQueue({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
    });
  }

  @Get(":id")
  @ApiGetOneAuth(PaymentDetailResponseDto, "payment request", {
    summary: "Get payment detail",
    description: "Payment detail retrieved successfully",
  })
  async getPaymentDetail(@Param("id") id: string): Promise<unknown> {
    return await this.subscriptionService.getPaymentRequestDetail(id);
  }

  @Post(":id/verify")
  @ApiAction(PaymentActionResponseDto, "verify", "payment", {
    summary: "Verify payment",
    description: "Payment verified successfully",
  })
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
  @ApiAction(PaymentActionResponseDto, "reject", "payment", {
    summary: "Reject payment",
    description: "Payment rejected successfully",
  })
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
