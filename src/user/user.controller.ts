import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AddUserToShopDto } from './dto/add-user-to-shop.dto';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto'; // Adjust the import path

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

  @Post('add-to-shop')
  @ApiOperation({ summary: 'Assign a user to a shop with a given role' })
  @ApiResponse({
    status: 200,
    description: 'User assigned to the shop successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 10,
          userId: 1,
          shopId: 2,
          role: 'ADMIN',
        },
        message: 'User added to shop successfully',
        error: null,
      },
    },
  })
  async addUserToShop(
    @Body() dto: AddUserToShopDto,
  ): Promise<BaseApiResponse<any>> {
    const userShop = await this.userService.addUserToShop(dto);
    return {
      status: 'success',
      data: userShop,
      message: 'User added to shop successfully',
      error: null,
    };
  }

  @Get(':id/shops')
  @ApiOperation({ summary: 'Get all shops/roles for a user' })
  @ApiResponse({
    status: 200,
    description: 'Lists all shops/roles associated with the user',
    schema: {
      example: {
        status: 'success',
        data: [
          {
            id: 10,
            userId: 1,
            shopId: 2,
            role: 'ADMIN',
          },
          {
            id: 11,
            userId: 1,
            shopId: 3,
            role: 'OWNER',
          },
        ],
        message: null,
        error: null,
      },
    },
  })
  async getUserShops(@Param('id') id: string): Promise<BaseApiResponse<any[]>> {
    const userShops = await this.userService.getUserShops(Number(id));
    return {
      status: 'success',
      data: userShops,
      message: null,
      error: null,
    };
  }
}
