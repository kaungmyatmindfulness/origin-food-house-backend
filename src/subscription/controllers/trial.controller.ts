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
import { ApiTags, ApiOperation, ApiExtraModels } from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import {
  ApiAuth,
  ApiAuthWithRoles,
  ApiUuidParam,
  ApiResourceErrors,
} from "../../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../../common/decorators/api-success-response.decorator";
import { GetUser } from "../../common/decorators/get-user.decorator";
import { StandardApiResponse } from "../../common/dto/standard-api-response.dto";
import {
  TrialEligibilityResponseDto,
  TrialInfoResponseDto,
} from "../dto/subscription-response.dto";
import { SubscriptionService } from "../services/subscription.service";
import { TrialService } from "../services/trial.service";

@ApiTags("Subscription - Trials")
@Controller("trials")
@UseGuards(JwtAuthGuard)
@ApiExtraModels(
  StandardApiResponse,
  TrialEligibilityResponseDto,
  TrialInfoResponseDto,
)
export class TrialController {
  private readonly logger = new Logger(TrialController.name);

  constructor(
    private readonly trialService: TrialService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get("eligibility")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Check if user is eligible for trial",
    description:
      "Returns whether the authenticated user can start a trial for a new store",
  })
  @ApiAuth()
  @ApiSuccessResponse(TrialEligibilityResponseDto, {
    description: "Trial eligibility status retrieved successfully",
  })
  async checkEligibility(
    @GetUser("sub") userId: string,
  ): Promise<StandardApiResponse<TrialEligibilityResponseDto>> {
    const method = this.checkEligibility.name;
    this.logger.log(`[${method}] User ${userId} checking trial eligibility`);

    const isEligible = await this.trialService.checkTrialEligibility(userId);

    return StandardApiResponse.success(
      { eligible: isEligible } as TrialEligibilityResponseDto,
      "Trial eligibility checked successfully",
    );
  }

  @Get("store/:storeId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get trial info for store (Owner/Admin only)",
    description: "Returns trial status and remaining days for a store",
  })
  @ApiAuthWithRoles()
  @ApiUuidParam("storeId", "Store ID (UUID)")
  @ApiSuccessResponse(TrialInfoResponseDto, {
    description: "Trial information retrieved successfully",
  })
  @ApiResourceErrors()
  async getTrialInfo(
    @GetUser("sub") userId: string,
    @Param("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<TrialInfoResponseDto>> {
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
      trialInfo as TrialInfoResponseDto,
      "Trial information retrieved successfully",
    );
  }
}
