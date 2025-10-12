import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiExtraModels,
} from '@nestjs/swagger';
import { Prisma, UserStore } from '@prisma/client';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { GetProfileQueryDto } from 'src/user/dto/get-profile-query.dto';
import { UserProfileResponseDto } from 'src/user/dto/user-profile-response.dto';

import { AddUserToStoreDto } from './dto/add-user-to-store.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserPublicPayload } from './types/user-payload.types';
import { UserService } from './user.service';

@ApiTags('Users')
@Controller('users')
@ApiExtraModels(
  StandardApiResponse,
  StandardApiErrorDetails,
  UserProfileResponseDto,
)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user (sends verification email)' })
  @ApiCreatedResponse({
    description: 'User registered successfully. Verification email sent.',
    type: StandardApiResponse,
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
  ): Promise<StandardApiResponse<UserPublicPayload>> {
    this.logger.log(`Registration attempt for email: ${createUserDto.email}`);
    const user = await this.userService.createUser(createUserDto);
    return StandardApiResponse.success(
      user,
      'User registered successfully. Please check your email to verify your account.',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('add-to-store')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Assign a user to a store with a role (Admin/Owner Protected - Example)',
  })
  @ApiOkResponse({
    description: 'User assigned/updated in store successfully.',
    type: StandardApiResponse,
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
  ): Promise<StandardApiResponse<UserStore>> {
    this.logger.log(
      `Request to add/update User ID ${dto.userId} in Store ID ${dto.storeId}`,
    );
    const userStore = await this.userService.addUserToStore(dto);
    return StandardApiResponse.success(
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
    description: 'ID (UUID) of the target user',
    type: String,
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'List of user store memberships retrieved.',
    type: StandardApiResponse,
  })
  @ApiForbiddenResponse({
    description: 'User does not have permission to view this.',
  })
  @ApiNotFoundResponse({ description: 'Target user not found.' })
  async getUserStores(
    @Param('id', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Req() req: RequestWithUser,
  ): Promise<
    StandardApiResponse<
      Array<UserStore & { store: Prisma.StoreGetPayload<true> }>
    >
  > {
    this.logger.log(
      `Request for stores of User ID: ${userId} by User ID: ${req.user.sub}`,
    );
    const userStores = await this.userService.getUserStores(userId);
    if (!userStores || userStores.length === 0) {
      const userExists = await this.userService.findById(userId);
      if (!userExists) {
        throw new NotFoundException(`User with ID ${userId} not found.`);
      }
    }
    return StandardApiResponse.success(
      userStores,
      'User stores retrieved successfully.',
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current logged-in user profile, optionally scoped to a store',
  })
  @ApiSuccessResponse(
    UserProfileResponseDto,
    'Current user profile retrieved successfully.',
  )
  @ApiQuery({
    name: 'storeId',
    required: false,
    type: String,
    format: 'uuid',
    description:
      'Optional: ID (UUID) of the store to get user context (e.g., role) for.', //
    example: '018ebc9a-7e1c-7f5e-b48a-3f4f72c55a1e',
  })
  async getCurrentUser(
    @Req() req: RequestWithUser,
    @Query() query: GetProfileQueryDto,
  ): Promise<StandardApiResponse<UserProfileResponseDto>> {
    const userId = req.user.sub;
    const { storeId } = query;
    const method = this.getCurrentUser.name;

    if (storeId) {
      this.logger.log(
        `[${method}] Request for profile of User ID: ${userId} with Store Context ID: ${storeId} from query`,
      );
    } else {
      this.logger.log(
        `[${method}] Request for profile of User ID: ${userId} without specific store context from query`,
      );
    }

    const userProfile = await this.userService.findUserProfile(userId, storeId);

    return StandardApiResponse.success(
      userProfile,
      'Profile retrieved successfully.',
    );
  }
}
