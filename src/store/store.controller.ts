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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreService } from './store.service';

import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { RequestWithUser } from 'src/auth/types';
import { CreateStoreDto } from 'src/store/dto/create-store.dto';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { UpdateStoreInformationDto } from 'src/store/dto/update-store-information.dto';

@ApiTags('Stores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stores')
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT.',
})
export class StoreController {
  private readonly logger = new Logger(StoreController.name);

  constructor(private storeService: StoreService) {}

  @Post()
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
  @ApiOperation({ summary: 'Update a store details (OWNER or ADMIN only)' })
  @ApiOkResponse({
    description: 'Store updated successfully.',
    type: StandardApiResponse,
  })
  async updateStore(
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

  @Post(':id/invite-assign-role')
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
