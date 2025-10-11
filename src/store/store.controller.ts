import {
  Controller,
  Post,
  Put,
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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiExtraModels,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreService } from './store.service';

import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { RequestWithUser } from 'src/auth/types';
import { CreateStoreDto } from 'src/store/dto/create-store.dto';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { UpdateStoreInformationDto } from 'src/store/dto/update-store-information.dto';
import { StoreSettingResponseDto } from 'src/store/dto/store-setting-response.dto';
import { UpdateStoreSettingDto } from 'src/store/dto/update-store-setting.dto';
import { GetStoreDetailsResponseDto } from 'src/store/dto/get-store-details-response.dto';
import { StoreInformationResponseDto } from 'src/store/dto/store-information-response.dto';

@ApiTags('Stores')
@Controller('stores')
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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get public details for a specific store by ID' })
  @ApiParam({
    name: 'id',
    description: 'ID (UUID) of the store to retrieve',
    type: String,
  })
  @ApiSuccessResponse(
    GetStoreDetailsResponseDto,
    'Store details retrieved successfully.',
  )
  @ApiNotFoundResponse({ description: 'Store not found.' })
  async getStoreDetails(
    @Param('id', ParseUUIDPipe) storeId: string,
  ): Promise<StandardApiResponse<GetStoreDetailsResponseDto>> {
    const method = this.getStoreDetails.name;
    this.logger.log(
      `[${method}] Fetching public details for Store ID: ${storeId}`,
    );
    const storeDetails = await this.storeService.getStoreDetails(storeId);
    return StandardApiResponse.success(
      storeDetails as GetStoreDetailsResponseDto,
      'Store details retrieved successfully.',
    );
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing JWT.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a store (creator becomes OWNER)' })
  @ApiSuccessResponse(String, {
    status: HttpStatus.CREATED,
    description: 'Store created successfully.',
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
      'Store created successfully. You have been assigned as the OWNER.',
    );
  }

  @Put(':id/information')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing JWT.',
  })
  @ApiOperation({ summary: 'Update a store details (OWNER or ADMIN only)' })
  @ApiOkResponse({
    description: 'Store updated successfully.',
    type: StandardApiResponse,
  })
  async updateStoreInformation(
    @Req() req: RequestWithUser,
    @Query('storeId', new ParseUUIDPipe({ version: '7' })) storeId: string,
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
      'Store updated successfully.',
    );
  }

  @Put(':id/settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing JWT.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update store settings (OWNER or ADMIN only)' })
  @ApiParam({
    name: 'id',
    description: 'ID (UUID) of the store whose settings to update',
    type: String,
  })
  @ApiSuccessResponse(
    StoreSettingResponseDto,
    'Store settings updated successfully.',
  )
  async updateStoreSettings(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) storeId: string,
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
      'Store settings updated successfully.',
    );
  }

  @Post(':id/invite-assign-role')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing JWT.',
  })
  @ApiOperation({
    summary:
      'Invite a new user or assign/update role for an existing user by email (Role permissions apply)',
    description:
      'Owner can assign any role. Admin can assign STAFF/CHEF roles. If user email doesnt exist, an invite might be implicitly handled by the service (or throw error).',
  })
  @ApiSuccessResponse(String, {
    status: HttpStatus.OK,
    description: 'Role assigned successfully.',
  })
  @ApiNotFoundResponse({ description: 'Store not found.' })
  async inviteOrAssignRoleByEmail(
    @Req() req: RequestWithUser,
    @Query('storeId', new ParseUUIDPipe({ version: '7' })) storeId: string,
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
}
