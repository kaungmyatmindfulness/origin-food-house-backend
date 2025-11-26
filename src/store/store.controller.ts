import {
  Controller,
  Post,
  Put,
  Patch,
  Body,
  UseGuards,
  Req,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  Param,
  Get,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiExtraModels,
} from "@nestjs/swagger";

import { RequestWithUser } from "src/auth/types";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { StandardApiErrorDetails } from "src/common/dto/standard-api-error-details.dto";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";
import { BusinessHoursDto } from "src/store/dto/business-hours.dto";
import { CreateStoreDto } from "src/store/dto/create-store.dto";
import { GetStoreDetailsResponseDto } from "src/store/dto/get-store-details-response.dto";
import { StoreInformationResponseDto } from "src/store/dto/store-information-response.dto";
import { StoreSettingResponseDto } from "src/store/dto/store-setting-response.dto";
import { UpdateLoyaltyRulesDto } from "src/store/dto/update-loyalty-rules.dto";
import { UpdateStoreInformationDto } from "src/store/dto/update-store-information.dto";
import { UpdateStoreSettingDto } from "src/store/dto/update-store-setting.dto";
import { UpdateTaxAndServiceChargeDto } from "src/store/dto/update-tax-and-service-charge.dto";

import { InviteOrAssignRoleDto } from "./dto/invite-or-assign-role.dto";
import { StoreService } from "./store.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Stores")
@Controller("stores")
@ApiExtraModels(
  StandardApiResponse,
  StandardApiErrorDetails,
  GetStoreDetailsResponseDto,
  StoreInformationResponseDto,
  StoreSettingResponseDto,
)
export class StoreController {
  private readonly logger = new Logger(StoreController.name);

  constructor(private storeService: StoreService) {}

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get public details for a specific store by ID" })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store to retrieve",
    type: String,
  })
  @ApiSuccessResponse(
    GetStoreDetailsResponseDto,
    "Store details retrieved successfully.",
  )
  @ApiNotFoundResponse({ description: "Store not found." })
  async getStoreDetails(
    @Param("id", ParseUUIDPipe) storeId: string,
  ): Promise<StandardApiResponse<GetStoreDetailsResponseDto>> {
    const method = this.getStoreDetails.name;
    this.logger.log(
      `[${method}] Fetching public details for Store ID: ${storeId}`,
    );
    const storeDetails = await this.storeService.getStoreDetails(storeId);
    return StandardApiResponse.success(
      storeDetails as GetStoreDetailsResponseDto,
      "Store details retrieved successfully.",
    );
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a store (creator becomes OWNER)" })
  @ApiSuccessResponse(String, {
    status: HttpStatus.CREATED,
    description: "Store created successfully.",
  })
  async createStore(
    @Req() req: RequestWithUser,
    @Body() dto: CreateStoreDto,
  ): Promise<StandardApiResponse<unknown>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} attempting to create store with name: ${dto.name}`,
    );
    const store = await this.storeService.createStore(userId, dto);
    this.logger.log(
      `Store '${store.slug}' (ID: ${store.id}) created successfully by User ${userId}.`,
    );

    return StandardApiResponse.success(
      store,
      "Store created successfully. You have been assigned as the OWNER.",
    );
  }

  @Put(":id/information")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @ApiOperation({ summary: "Update a store details (OWNER or ADMIN only)" })
  @ApiOkResponse({
    description: "Store updated successfully.",
    type: StandardApiResponse,
  })
  async updateStoreInformation(
    @Req() req: RequestWithUser,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: UpdateStoreInformationDto,
  ): Promise<StandardApiResponse<unknown>> {
    const userId = req.user.sub;
    this.logger.log(`User ${userId} attempting to update Store ID: ${storeId}`);

    const updatedStore = await this.storeService.updateStoreInformation(
      userId,
      storeId,
      dto,
    );
    this.logger.log(
      `Store ID ${storeId} updated successfully by User ${userId}.`,
    );
    return StandardApiResponse.success(
      updatedStore,
      "Store updated successfully.",
    );
  }

  @Put(":id/settings")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update store settings (OWNER or ADMIN only)" })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store whose settings to update",
    type: String,
  })
  @ApiSuccessResponse(
    StoreSettingResponseDto,
    "Store settings updated successfully.",
  )
  async updateStoreSettings(
    @Req() req: RequestWithUser,
    @Param("id", ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateStoreSettingDto,
  ): Promise<StandardApiResponse<StoreSettingResponseDto>> {
    const userId = req.user.sub;
    const method = this.updateStoreSettings.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update settings for Store ID: ${storeId}`,
    );

    const updatedSettings = await this.storeService.updateStoreSettings(
      userId,
      storeId,
      dto,
    );

    const mappedSettings: StoreSettingResponseDto = {
      id: updatedSettings.id,
      storeId: updatedSettings.storeId,
      currency: updatedSettings.currency,
      vatRate: updatedSettings.vatRate?.toString() ?? null,
      serviceChargeRate: updatedSettings.serviceChargeRate?.toString() ?? null,
      createdAt: updatedSettings.createdAt,
      updatedAt: updatedSettings.updatedAt,
    };

    return StandardApiResponse.success(
      mappedSettings,
      "Store settings updated successfully.",
    );
  }

  @Post(":id/members")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Add store member or update existing member role (OWNER, ADMIN)",
    description:
      "Invite a new user or update role for an existing user by email. Owner can assign any role. Admin can assign SERVER/CHEF/CASHIER roles.",
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(String, {
    status: HttpStatus.CREATED,
    description: "Member added or role updated successfully.",
  })
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @ApiNotFoundResponse({ description: "Store not found." })
  async inviteOrAssignRoleByEmail(
    @Req() req: RequestWithUser,
    @Param("id", new ParseUUIDPipe({ version: "7" })) storeId: string,
    @Body() dto: InviteOrAssignRoleDto,
  ): Promise<StandardApiResponse<unknown>> {
    const requestingUserId = req.user.sub;

    this.logger.log(
      `User ${requestingUserId} attempting to assign role ${dto.role} to email ${dto.email} in Store ID: ${storeId}`,
    );
    const result = await this.storeService.inviteOrAssignRoleByEmail(
      requestingUserId,
      storeId,
      dto,
    );

    const message = `Role ${dto.role} assigned to user with email ${dto.email} in store ${storeId}.`;

    this.logger.log(
      `Role assignment result for email ${dto.email} in Store ID ${storeId}: ${message}`,
    );
    return StandardApiResponse.success(result, message);
  }

  @Patch(":id/settings/tax-and-service")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update tax and service charge rates (OWNER or ADMIN only)",
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(
    StoreSettingResponseDto,
    "Tax and service charge rates updated successfully.",
  )
  async updateTaxAndServiceCharge(
    @GetUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateTaxAndServiceChargeDto,
  ): Promise<StandardApiResponse<StoreSettingResponseDto>> {
    const method = this.updateTaxAndServiceCharge.name;
    this.logger.log(
      `[${method}] User ${userId} updating tax/service charge for Store ID: ${storeId}`,
    );

    const settings = await this.storeService.updateTaxAndServiceCharge(
      userId,
      storeId,
      dto.vatRate,
      dto.serviceChargeRate,
    );

    const mappedSettings: StoreSettingResponseDto = {
      id: settings.id,
      storeId: settings.storeId,
      currency: settings.currency,
      vatRate: settings.vatRate?.toString() ?? null,
      serviceChargeRate: settings.serviceChargeRate?.toString() ?? null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };

    return StandardApiResponse.success(
      mappedSettings,
      "Tax and service charge rates updated successfully.",
    );
  }

  @Patch(":id/settings/business-hours")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update business hours (OWNER or ADMIN only)",
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(
    StoreSettingResponseDto,
    "Business hours updated successfully.",
  )
  async updateBusinessHours(
    @GetUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) storeId: string,
    @Body() dto: BusinessHoursDto,
  ): Promise<StandardApiResponse<StoreSettingResponseDto>> {
    const method = this.updateBusinessHours.name;
    this.logger.log(
      `[${method}] User ${userId} updating business hours for Store ID: ${storeId}`,
    );

    const settings = await this.storeService.updateBusinessHours(
      userId,
      storeId,
      dto,
    );

    const mappedSettings: StoreSettingResponseDto = {
      id: settings.id,
      storeId: settings.storeId,
      currency: settings.currency,
      vatRate: settings.vatRate?.toString() ?? null,
      serviceChargeRate: settings.serviceChargeRate?.toString() ?? null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };

    return StandardApiResponse.success(
      mappedSettings,
      "Business hours updated successfully.",
    );
  }

  @Post(":id/settings/branding")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "logo", maxCount: 1 },
      { name: "cover", maxCount: 1 },
    ]),
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Upload branding images (logo and/or cover) (OWNER or ADMIN only)",
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(
    StoreInformationResponseDto,
    "Branding uploaded successfully.",
  )
  async uploadBranding(
    @GetUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) storeId: string,
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ): Promise<StandardApiResponse<StoreInformationResponseDto>> {
    const method = this.uploadBranding.name;
    this.logger.log(
      `[${method}] User ${userId} uploading branding for Store ID: ${storeId}`,
    );

    const information = await this.storeService.uploadBranding(
      userId,
      storeId,
      files.logo?.[0],
      files.cover?.[0],
    );

    return StandardApiResponse.success(
      information as StoreInformationResponseDto,
      "Branding uploaded successfully.",
    );
  }

  @Patch(":id/settings/loyalty-rules")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: "Unauthorized - Invalid or missing JWT.",
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update loyalty program rules (OWNER only)",
  })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the store",
    type: String,
  })
  @ApiSuccessResponse(
    StoreSettingResponseDto,
    "Loyalty rules updated successfully.",
  )
  async updateLoyaltyRules(
    @GetUser("sub") userId: string,
    @Param("id", ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateLoyaltyRulesDto,
  ): Promise<StandardApiResponse<StoreSettingResponseDto>> {
    const method = this.updateLoyaltyRules.name;
    this.logger.log(
      `[${method}] User ${userId} updating loyalty rules for Store ID: ${storeId}`,
    );

    const settings = await this.storeService.updateLoyaltyRules(
      userId,
      storeId,
      dto.pointRate,
      dto.redemptionRate,
      dto.expiryDays,
    );

    const mappedSettings: StoreSettingResponseDto = {
      id: settings.id,
      storeId: settings.storeId,
      currency: settings.currency,
      vatRate: settings.vatRate?.toString() ?? null,
      serviceChargeRate: settings.serviceChargeRate?.toString() ?? null,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };

    return StandardApiResponse.success(
      mappedSettings,
      "Loyalty rules updated successfully.",
    );
  }
}
