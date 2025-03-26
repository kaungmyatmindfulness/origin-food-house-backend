import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AddUserToStoreDto } from './dto/add-user-to-store.dto';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto'; // Adjust the import path
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user (with email verification)',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 1,
          email: 'john@example.com',
          // other user fields
        },
        message: 'User registered successfully',
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation or other client error',
    schema: {
      example: {
        status: 'error',
        data: null,
        message: 'Validation error',
        error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
      },
    },
  })
  async register(
    @Body() createUserDto: CreateUserDto,
  ): Promise<BaseApiResponse<any>> {
    // The service returns the new user record
    const user = await this.userService.createUser(createUserDto);
    return {
      status: 'success',
      data: user, // The newly created user data
      message: 'User registered successfully',
      error: null,
    };
  }

  @Post('add-to-store')
  @ApiOperation({ summary: 'Assign a user to a store with a given role' })
  @ApiResponse({
    status: 200,
    description: 'User assigned to the store successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 10,
          userId: 1,
          storeId: 2,
          role: 'ADMIN',
        },
        message: 'User added to store successfully',
        error: null,
      },
    },
  })
  async addUserToStore(
    @Body() dto: AddUserToStoreDto,
  ): Promise<BaseApiResponse<any>> {
    const userStore = await this.userService.addUserToStore(dto);
    return {
      status: 'success',
      data: userStore,
      message: 'User added to store successfully',
      error: null,
    };
  }

  @Get(':id/stores')
  @ApiOperation({ summary: 'Get all stores/roles for a user' })
  @ApiResponse({
    status: 200,
    description: 'Lists all stores/roles associated with the user',
    schema: {
      example: {
        status: 'success',
        data: [
          {
            id: 10,
            userId: 1,
            storeId: 2,
            role: 'ADMIN',
          },
          {
            id: 11,
            userId: 1,
            storeId: 3,
            role: 'OWNER',
          },
        ],
        message: null,
        error: null,
      },
    },
  })
  async getUserStores(
    @Param('id') id: string,
  ): Promise<BaseApiResponse<any[]>> {
    const userStores = await this.userService.getUserStores(Number(id));
    return {
      status: 'success',
      data: userStores,
      message: null,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({
    summary: 'Get current user info (profile, roles, stores, etc.)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Returns the current user details',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 12,
          email: 'john@example.com',
          name: 'John Doe',
          userStores: [
            {
              id: 50,
              role: 'OWNER',
              store: {
                id: 7,
                name: 'Coffee Corner',
                address: '123 Brew St',
                phoneNumber: '555-1234',
              },
            },
            {
              id: 51,
              role: 'ADMIN',
              store: {
                id: 10,
                name: 'Pasta Place',
                address: '45 Noodle Ave',
                phoneNumber: '555-5678',
              },
            },
          ],
          currentStore: {
            id: 7,
            name: 'Coffee Corner',
            address: '123 Brew St',
            phoneNumber: '555-1234',
          },
          currentRole: 'OWNER',
        },
        message: null,
        error: null,
      },
    },
  })
  async getCurrentUser(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    const storeId = req.user.storeId;
    const user = await this.userService.findUserProfile(userId, storeId);

    return {
      status: 'success',
      data: user,
      message: null,
      error: null,
    };
  }
}
