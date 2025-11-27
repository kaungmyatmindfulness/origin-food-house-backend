import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiExtraModels,
} from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import { CreateRefundRequestDto } from "../dto/create-refund-request.dto";
import { RefundRequestResponseDto } from "../dto/subscription-response.dto";
import { RefundService } from "../services/refund.service";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription - Refunds")
@Controller("refund-requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiExtraModels(StandardApiResponse, RefundRequestResponseDto)
export class RefundController {
  private readonly logger = new Logger(RefundController.name);

  constructor(
    private readonly refundService: RefundService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Request refund (Owner/Admin only)",
    description: "Submit a refund request for an active subscription",
  })
  @ApiSuccessResponse(RefundRequestResponseDto, {
    status: HttpStatus.CREATED,
    description: "Refund request created successfully",
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions or not subscription owner",
  })
  @ApiNotFoundResponse({ description: "Subscription not found" })
  @ApiBadRequestResponse({
    description: "Subscription not eligible for refund",
  })
  async requestRefund(
    @GetUser("sub") userId: string,
    @Body() dto: CreateRefundRequestDto,
  ): Promise<StandardApiResponse<RefundRequestResponseDto>> {
    const method = this.requestRefund.name;
    this.logger.log(
      `[${method}] User ${userId} requesting refund for subscription ${dto.subscriptionId}`,
    );

    const refundRequest = await this.refundService.createRefundRequest(
      userId,
      dto.subscriptionId,
      dto.reason,
    );

    return StandardApiResponse.success(
      refundRequest as RefundRequestResponseDto,
      "Refund request submitted successfully",
    );
  }

  @Get("store/:storeId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get refund requests for store (Owner/Admin only)",
    description: "Retrieve all refund requests for a specific store",
  })
  @ApiParam({ name: "storeId", description: "Store ID (UUID)" })
  @ApiSuccessResponse(RefundRequestResponseDto, {
    description: "Refund requests retrieved successfully",
    isArray: true,
  })
  @ApiForbiddenResponse({
    description: "Insufficient permissions (OWNER/ADMIN required)",
  })
  @ApiNotFoundResponse({ description: "Store not found" })
  async getStoreRefundRequests(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<RefundRequestResponseDto[]>> {
    const method = this.getStoreRefundRequests.name;
    this.logger.log(
      `[${method}] User ${userId} fetching refund requests for store ${storeId}`,
    );

    await this.subscriptionService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    const refundRequests =
      await this.refundService.getStoreRefundRequests(storeId);

    return StandardApiResponse.success(
      refundRequests as RefundRequestResponseDto[],
      "Refund requests retrieved successfully",
    );
  }
}
