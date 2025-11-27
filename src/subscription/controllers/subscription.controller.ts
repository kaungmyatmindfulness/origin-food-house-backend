import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiExtraModels, ApiOperation } from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import {
  ApiAuthWithRoles,
  ApiUuidParam,
  ApiResourceErrors,
} from "../../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import { SubscriptionResponseDto } from "../dto/subscription-response.dto";
import { SubscriptionService } from "../services/subscription.service";

@ApiTags("Subscription")
@Controller("subscriptions")
@UseGuards(JwtAuthGuard)
@ApiExtraModels(StandardApiResponse, SubscriptionResponseDto)
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get("store/:storeId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get subscription for store (Owner/Admin only)" })
  @ApiAuthWithRoles()
  @ApiUuidParam("storeId", "Store ID (UUID)")
  @ApiSuccessResponse(SubscriptionResponseDto, {
    description: "Subscription retrieved successfully",
  })
  @ApiResourceErrors()
  async getStoreSubscription(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<SubscriptionResponseDto>> {
    const method = this.getStoreSubscription.name;
    this.logger.log(
      `[${method}] User ${userId} fetching subscription for store ${storeId}`,
    );

    await this.subscriptionService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    const subscription =
      await this.subscriptionService.getStoreSubscription(storeId);

    return StandardApiResponse.success(
      subscription as SubscriptionResponseDto,
      "Subscription retrieved successfully",
    );
  }
}
