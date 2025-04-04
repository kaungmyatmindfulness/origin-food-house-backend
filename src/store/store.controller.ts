import {
  Controller,
  Post,
  Put, // Note: Consider PATCH if partial updates are allowed by UpdateStoreDto
  Body,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  Logger, // Added Logger
  HttpCode, // Added HttpCode
  HttpStatus, // Added HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse, // Added specific response types
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InviteOrAssignRoleDto } from './dto/invite-or-assign-role.dto';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types'; // Assuming correct path
import { Store, UserStore } from '@prisma/client'; // Import Prisma types

@ApiTags('stores')
@ApiBearerAuth() // All routes require JWT
@UseGuards(JwtAuthGuard)
@Controller('stores')
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT.',
}) // Global 401 response
export class StoreController {
  private readonly logger = new Logger(StoreController.name); // Added logger

  constructor(private storeService: StoreService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED) // Set 201 Created status
  @ApiOperation({ summary: 'Create a store (creator becomes OWNER)' })
  @ApiCreatedResponse({
    description: 'Store created successfully.',
    type: BaseApiResponse,
  }) // Use specific type if creating Response DTO
  @ApiBadRequestResponse({ description: 'Invalid input data.' })
  async createStore(
    @Req() req: RequestWithUser,
    @Body() dto: CreateStoreDto,
  ): Promise<BaseApiResponse<Store>> {
    // Specific return type
    const userId = req.user.sub; // Get user ID from JWT 'sub' claim
    this.logger.log(
      `User ${userId} attempting to create store with name: ${dto.name}`,
    );
    const store = await this.storeService.createStore(userId, dto);
    this.logger.log(
      `Store '${store.name}' (ID: ${store.id}) created successfully by User ${userId}.`,
    );
    // Use BaseApiResponse helper
    return BaseApiResponse.success(
      store,
      'Store created successfully. You have been assigned as the OWNER.',
    );
  }

  // Note: PUT implies replacing the resource. If UpdateStoreDto allows partial updates,
  // consider using @Patch decorator instead for semantic correctness.
  @Put(':id')
  @ApiOperation({ summary: 'Update a store details (OWNER or ADMIN only)' })
  @ApiOkResponse({
    description: 'Store updated successfully.',
    type: BaseApiResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data.' })
  @ApiForbiddenResponse({
    description: 'User lacks OWNER/ADMIN role for this store.',
  })
  @ApiNotFoundResponse({ description: 'Store not found.' })
  async updateStore(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) storeId: number,
    @Body() dto: UpdateStoreDto,
  ): Promise<BaseApiResponse<Store>> {
    // Specific return type
    const userId = req.user.sub;
    this.logger.log(`User ${userId} attempting to update Store ID: ${storeId}`);
    // StoreService.updateStore should handle permission checks (Owner/Admin of storeId)
    const updatedStore = await this.storeService.updateStore(
      userId,
      storeId,
      dto,
    );
    this.logger.log(
      `Store ID ${storeId} updated successfully by User ${userId}.`,
    );
    return BaseApiResponse.success(updatedStore, 'Store updated successfully.');
  }

  @Post(':id/invite-assign-role') // Renamed slightly for clarity
  @ApiOperation({
    summary:
      'Invite a new user or assign/update role for an existing user by email (Role permissions apply)',
    description:
      'Owner can assign any role. Admin can assign STAFF/CHEF roles. If user email doesnt exist, an invite might be implicitly handled by the service (or throw error).',
  })
  @ApiOkResponse({
    description: 'User role assigned/updated successfully.',
    type: BaseApiResponse,
  }) // Type depends on what service returns
  @ApiBadRequestResponse({
    description: 'Invalid input data (e.g., invalid email, invalid role).',
  })
  @ApiForbiddenResponse({
    description:
      'Requesting user lacks permission to assign the specified role in this store.',
  })
  @ApiNotFoundResponse({ description: 'Store not found.' }) // Service should check storeId
  async inviteOrAssignRoleByEmail(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) storeId: number,
    @Body() dto: InviteOrAssignRoleDto,
    // Specify expected return type based on service implementation
    // Could be UserStore, or a message object, or combined
  ): Promise<BaseApiResponse<UserStore | { message: string }>> {
    const requestingUserId = req.user.sub;
    // We assume the JWT might or might not have the target storeId if admin manages multiple stores
    // Permissions must be checked within the service based on requestingUserId and target storeId
    this.logger.log(
      `User ${requestingUserId} attempting to assign role ${dto.role} to email ${dto.email} in Store ID: ${storeId}`,
    );
    const result = await this.storeService.inviteOrAssignRoleByEmail(
      requestingUserId, // The user performing the action
      storeId, // The target store
      dto, // Contains target email and role
    );

    // Construct message dynamically based on result type if needed
    const message = `Role ${dto.role} assigned to user with email ${dto.email} in store ${storeId}.`;

    this.logger.log(
      `Role assignment result for email ${dto.email} in Store ID ${storeId}: ${message}`,
    );
    return BaseApiResponse.success(result, message);
  }
}
