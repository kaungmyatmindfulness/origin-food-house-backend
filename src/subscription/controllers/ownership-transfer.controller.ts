import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
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
import { InitiateOwnershipTransferDto } from "../dto/initiate-ownership-transfer.dto";
import { OwnershipTransferResponseDto } from "../dto/subscription-response.dto";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { OwnershipTransferService } from "../services/ownership-transfer.service";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription - Ownership Transfer")
@Controller("ownership-transfers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiExtraModels(StandardApiResponse, OwnershipTransferResponseDto)
export class OwnershipTransferController {
  private readonly logger = new Logger(OwnershipTransferController.name);

  constructor(
    private readonly ownershipTransferService: OwnershipTransferService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Initiate ownership transfer (Owner only)",
    description:
      "Start the ownership transfer process. An OTP will be sent to the current owner's email for verification.",
  })
  @ApiSuccessResponse(OwnershipTransferResponseDto, {
    status: HttpStatus.CREATED,
    description: "Ownership transfer initiated successfully",
  })
  @ApiForbiddenResponse({
    description: "Only store owners can transfer ownership",
  })
  @ApiNotFoundResponse({ description: "Store not found" })
  @ApiBadRequestResponse({
    description: "New owner email is invalid or same as current owner",
  })
  async initiateTransfer(
    @GetUser("sub") userId: string,
    @Body() dto: InitiateOwnershipTransferDto,
  ): Promise<StandardApiResponse<OwnershipTransferResponseDto>> {
    const method = this.initiateTransfer.name;
    this.logger.log(
      `[${method}] User ${userId} initiating ownership transfer for store ${dto.storeId} to ${dto.newOwnerEmail}`,
    );

    await this.subscriptionService.checkStorePermission(userId, dto.storeId, [
      Role.OWNER,
    ]);

    const transfer = await this.ownershipTransferService.initiateTransfer(
      userId,
      dto.storeId,
      dto.newOwnerEmail,
    );

    return StandardApiResponse.success(
      transfer as OwnershipTransferResponseDto,
      "Ownership transfer initiated successfully. OTP sent to your email.",
    );
  }

  @Post(":id/verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify OTP and complete ownership transfer (Owner only)",
    description:
      "Complete the ownership transfer by verifying the OTP sent to the current owner's email",
  })
  @ApiParam({ name: "id", description: "Transfer ID (UUID)" })
  @ApiSuccessResponse(OwnershipTransferResponseDto, {
    description: "Ownership transfer completed successfully",
  })
  @ApiForbiddenResponse({
    description: "Only the initiating owner can verify the transfer",
  })
  @ApiNotFoundResponse({ description: "Transfer not found or expired" })
  @ApiBadRequestResponse({
    description: "Invalid OTP or transfer already completed/cancelled",
  })
  async verifyOtp(
    @GetUser("sub") userId: string,
    @Param("id") transferId: string,
    @Body() dto: VerifyOtpDto,
  ): Promise<StandardApiResponse<null>> {
    const method = this.verifyOtp.name;
    this.logger.log(
      `[${method}] User ${userId} verifying OTP for transfer ${transferId}`,
    );

    await this.ownershipTransferService.verifyOtp(userId, transferId, dto.otp);

    return StandardApiResponse.success(
      null,
      "Ownership transfer completed successfully",
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cancel ownership transfer (Owner only)",
    description: "Cancel a pending ownership transfer before it's completed",
  })
  @ApiParam({ name: "id", description: "Transfer ID (UUID)" })
  @ApiSuccessResponse(OwnershipTransferResponseDto, {
    description: "Ownership transfer cancelled successfully",
  })
  @ApiForbiddenResponse({
    description: "Only the initiating owner can cancel the transfer",
  })
  @ApiNotFoundResponse({ description: "Transfer not found" })
  @ApiBadRequestResponse({
    description: "Transfer already completed or cancelled",
  })
  async cancelTransfer(
    @GetUser("sub") userId: string,
    @Param("id") transferId: string,
  ): Promise<StandardApiResponse<null>> {
    const method = this.cancelTransfer.name;
    this.logger.log(
      `[${method}] User ${userId} cancelling transfer ${transferId}`,
    );

    await this.ownershipTransferService.cancelTransfer(userId, transferId);

    return StandardApiResponse.success(
      null,
      "Ownership transfer cancelled successfully",
    );
  }
}
