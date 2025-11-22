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
} from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import { InitiateOwnershipTransferDto } from "../dto/initiate-ownership-transfer.dto";
import { VerifyOtpDto } from "../dto/verify-otp.dto";
import { OwnershipTransferService } from "../services/ownership-transfer.service";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription - Ownership Transfer")
@Controller("ownership-transfers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class OwnershipTransferController {
  private readonly logger = new Logger(OwnershipTransferController.name);

  constructor(
    private readonly ownershipTransferService: OwnershipTransferService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Initiate ownership transfer (Owner only)" })
  @ApiSuccessResponse(Object, {
    status: HttpStatus.CREATED,
    description: "Ownership transfer initiated successfully",
  })
  async initiateTransfer(
    @GetUser("sub") userId: string,
    @Body() dto: InitiateOwnershipTransferDto,
  ): Promise<StandardApiResponse<unknown>> {
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
      transfer,
      "Ownership transfer initiated successfully. OTP sent to your email.",
    );
  }

  @Post(":id/verify-otp")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify OTP and complete ownership transfer (Owner only)",
  })
  @ApiParam({ name: "id", description: "Transfer ID" })
  @ApiSuccessResponse(Object, {
    description: "Ownership transfer completed successfully",
  })
  async verifyOtp(
    @GetUser("sub") userId: string,
    @Param("id") transferId: string,
    @Body() dto: VerifyOtpDto,
  ): Promise<StandardApiResponse<unknown>> {
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
  @ApiOperation({ summary: "Cancel ownership transfer (Owner only)" })
  @ApiParam({ name: "id", description: "Transfer ID" })
  @ApiSuccessResponse(Object, {
    description: "Ownership transfer cancelled successfully",
  })
  async cancelTransfer(
    @GetUser("sub") userId: string,
    @Param("id") transferId: string,
  ): Promise<StandardApiResponse<unknown>> {
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
