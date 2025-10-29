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
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from "@nestjs/swagger";
import { Role } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import { CreatePaymentRequestDto } from "../dto/create-payment-request.dto";
import { PaymentProofService } from "../services/payment-proof.service";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription - Payment Requests")
@Controller("payment-requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PaymentRequestController {
  private readonly logger = new Logger(PaymentRequestController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentProofService: PaymentProofService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create payment request for tier upgrade (Owner/Admin only)",
  })
  @ApiSuccessResponse(Object, {
    status: HttpStatus.CREATED,
    description: "Payment request created successfully",
  })
  async createPaymentRequest(
    @GetUser("sub") userId: string,
    @Body() dto: CreatePaymentRequestDto,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.createPaymentRequest.name;
    this.logger.log(
      `[${method}] User ${userId} creating payment request for store ${dto.storeId} with tier ${dto.tier}`,
    );

    await this.subscriptionService.checkStorePermission(userId, dto.storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    const paymentRequest = await this.subscriptionService.createPaymentRequest(
      userId,
      dto.storeId,
      dto.tier,
    );

    return StandardApiResponse.success(
      paymentRequest,
      "Payment request created successfully",
    );
  }

  @Post(":id/upload-proof")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload payment proof (Owner/Admin only)" })
  @ApiParam({ name: "id", description: "Payment request ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment proof uploaded successfully",
  })
  async uploadPaymentProof(
    @GetUser("sub") userId: string,
    @Param("id") paymentRequestId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.uploadPaymentProof.name;
    this.logger.log(
      `[${method}] User ${userId} uploading payment proof for request ${paymentRequestId}`,
    );

    const result = await this.paymentProofService.uploadPaymentProof(
      userId,
      paymentRequestId,
      file,
    );

    return StandardApiResponse.success(
      result,
      "Payment proof uploaded successfully",
    );
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get payment request details (Owner/Admin only)" })
  @ApiParam({ name: "id", description: "Payment request ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment request details retrieved successfully",
  })
  async getPaymentRequest(
    @GetUser("sub") userId: string,
    @Param("id") paymentRequestId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getPaymentRequest.name;
    this.logger.log(
      `[${method}] User ${userId} fetching payment request ${paymentRequestId}`,
    );

    const paymentRequest = await this.subscriptionService.getPaymentRequest(
      userId,
      paymentRequestId,
    );

    return StandardApiResponse.success(
      paymentRequest,
      "Payment request retrieved successfully",
    );
  }

  @Get("store/:storeId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get all payment requests for store (Owner/Admin only)",
  })
  @ApiParam({ name: "storeId", description: "Store ID" })
  @ApiSuccessResponse(Object, {
    description: "Payment requests retrieved successfully",
  })
  async getStorePaymentRequests(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getStorePaymentRequests.name;
    this.logger.log(
      `[${method}] User ${userId} fetching payment requests for store ${storeId}`,
    );

    await this.subscriptionService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    const paymentRequests =
      await this.subscriptionService.getStorePaymentRequests(storeId);

    return StandardApiResponse.success(
      paymentRequests,
      "Payment requests retrieved successfully",
    );
  }
}
