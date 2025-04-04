import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
  Logger,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiParam,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AddUserToStoreDto } from './dto/add-user-to-store.dto';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Prisma, Role, UserStore, Store } from '@prisma/client'; // Keep Prisma types needed

// ** Import specific types **
import { UserPublicPayload } from './types/user-payload.types';
import { UserProfileResponse } from './types/user-profile.response';

@ApiTags('user')
@Controller('user')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user (sends verification email)' })
  @ApiCreatedResponse({
    description: 'User registered successfully. Verification email sent.',
    type: BaseApiResponse, // Consider creating specific Response DTOs for Swagger accuracy
  })
  @ApiBadRequestResponse({
    description:
      'Validation error (e.g., email exists, disposable domain, invalid input)',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error (e.g., failed to send email)',
  })
  async register(
    @Body() createUserDto: CreateUserDto,
  ): Promise<BaseApiResponse<UserPublicPayload>> {
    // ** Corrected return type **
    this.logger.log(`Registration attempt for email: ${createUserDto.email}`);
    const user = await this.userService.createUser(createUserDto);
    return BaseApiResponse.success(
      user, // user object matches UserPublicPayload now
      'User registered successfully. Please check your email to verify your account.',
    );
  }

  // --- Authorization Required Beyond This Point ---

  @UseGuards(JwtAuthGuard)
  @Post('add-to-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Assign a user to a store with a role (Admin/Owner Protected - Example)',
  })
  @ApiOkResponse({
    description: 'User assigned/updated in store successfully.',
    type: BaseApiResponse, // Consider specific Response DTO
  })
  @ApiBadRequestResponse({
    description: 'Validation error (e.g., invalid role, missing fields)',
  })
  @ApiNotFoundResponse({ description: 'User or Store not found.' })
  @ApiForbiddenResponse({
    description: 'User does not have permission to perform this action.',
  })
  async addUserToStore(
    @Body() dto: AddUserToStoreDto,
  ): Promise<BaseApiResponse<UserStore>> {
    // ... (authorization TODO remains) ...
    this.logger.log(
      `Request to add/update User ID ${dto.userId} in Store ID ${dto.storeId}`,
    );
    const userStore = await this.userService.addUserToStore(dto);
    return BaseApiResponse.success(
      userStore,
      'User role in store updated successfully.',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/stores')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all store memberships for a specific user (Protected)',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric ID of the target user',
    type: Number,
  })
  @ApiOkResponse({
    description: 'List of user store memberships retrieved.',
    type: BaseApiResponse, // Consider specific Response DTO
  })
  @ApiForbiddenResponse({
    description: 'User does not have permission to view this.',
  })
  @ApiNotFoundResponse({ description: 'Target user not found.' })
  async getUserStores(
    @Param('id', ParseIntPipe) userId: number,
    @Req() req: RequestWithUser,
  ): Promise<
    BaseApiResponse<Array<UserStore & { store: Prisma.StoreGetPayload<true> }>> // Use Prisma type directly
  > {
    // ... (authorization TODO remains) ...
    this.logger.log(
      `Request for stores of User ID: ${userId} by User ID: ${req.user.sub}`,
    );
    const userStores = await this.userService.getUserStores(userId);
    if (!userStores || userStores.length === 0) {
      const userExists = await this.userService.findById(userId); // findById now returns public payload or null
      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }
    }
    return BaseApiResponse.success(
      userStores,
      'User stores retrieved successfully.',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current logged-in user profile' })
  @ApiOkResponse({
    description: 'Current user profile retrieved successfully.',
    type: BaseApiResponse, // Consider specific Response DTO using UserProfileResponse
  })
  @ApiNotFoundResponse({ description: 'User associated with token not found.' })
  async getCurrentUser(
    @Req() req: RequestWithUser,
  ): Promise<BaseApiResponse<UserProfileResponse>> {
    // ** Use imported type **
    const userId = req.user.sub;
    const storeId = 'storeId' in req.user ? req.user.storeId : undefined;
    this.logger.log(
      `Request for profile of User ID: ${userId}, Current Store Context: ${storeId ?? 'None'}`,
    );
    const userProfile = await this.userService.findUserProfile(userId, storeId);
    return BaseApiResponse.success(
      userProfile,
      'Profile retrieved successfully.',
    );
  }
}
