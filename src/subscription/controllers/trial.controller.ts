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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { Role } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import { SubscriptionService } from "../services/subscription.service";
import { TrialService } from "../services/trial.service";

@ApiTags("Subscription - Trials")
@Controller("trials")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class TrialController {
  private readonly logger = new Logger(TrialController.name);

  constructor(
    private readonly trialService: TrialService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get("eligibility")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Check if user is eligible for trial" })
  @ApiSuccessResponse(Object, {
    description: "Trial eligibility status retrieved successfully",
  })
  async checkEligibility(
    @GetUser("sub") userId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.checkEligibility.name;
    this.logger.log(`[${method}] User ${userId} checking trial eligibility`);

    const eligibility = await this.trialService.checkTrialEligibility(userId);

    return StandardApiResponse.success(
      eligibility,
      "Trial eligibility checked successfully",
    );
  }

  @Get("store/:storeId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get trial info for store (Owner/Admin only)" })
  @ApiParam({ name: "storeId", description: "Store ID" })
  @ApiSuccessResponse(Object, {
    description: "Trial information retrieved successfully",
  })
  async getTrialInfo(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.getTrialInfo.name;
    this.logger.log(
      `[${method}] User ${userId} fetching trial info for store ${storeId}`,
    );

    await this.subscriptionService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    const trialInfo = await this.trialService.getTrialInfo(storeId);

    return StandardApiResponse.success(
      trialInfo,
      "Trial information retrieved successfully",
    );
  }
}
