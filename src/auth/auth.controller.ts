import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ChooseShopDto } from './dto/choose-shop.dto';

import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email/password (step 1)' })
  @ApiResponse({
    status: 200,
    description: 'Credentials valid; user must choose a shop next.',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 1,
          email: 'john@example.com',
          verified: true,
        },
        message: 'Credentials valid. Please choose a shop to finalize login.',
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or user not verified',
    schema: {
      example: {
        status: 'error',
        data: null,
        message: 'Invalid credentials',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Email or password is incorrect',
        },
      },
    },
  })
  login(@Request() req: RequestWithUser, @Body() _: LoginDto) {
    // By now, LocalAuthGuard has validated the credentials
    // and attached the user object to req.user.
    // We return a success response, prompting the user to pick a shop next.

    return {
      status: 'success',
      data: req.user,
      message: 'Credentials valid. Please choose a shop to finalize login.',
      error: null,
    };
  }

  @Post('login/shop')
  @ApiOperation({ summary: 'Choose a shop to finalize login (step 2)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a JWT token containing userId, shopId, role',
    schema: {
      example: {
        status: 'success',
        data: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        message: null,
        error: null,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'User is not a member of the chosen shop',
    schema: {
      example: {
        status: 'error',
        data: null,
        message: 'User not a member of this shop',
        error: {
          code: 'UNAUTHORIZED',
          message: 'User does not have access to shop=2',
        },
      },
    },
  })
  async loginWithShop(
    @Body() body: ChooseShopDto,
  ): Promise<BaseApiResponse<{ access_token: string }>> {
    const result = await this.authService.loginWithShop(
      body.userId,
      body.shopId,
    );
    return {
      status: 'success',
      data: result, // e.g., { access_token: '...' }
      message: null,
      error: null,
    };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: {
        status: 'success',
        data: null,
        message: 'Email verified successfully.',
        error: null,
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid token',
    schema: {
      example: {
        status: 'error',
        data: null,
        message: 'Invalid or expired token',
        error: {
          code: 'BAD_REQUEST',
          message: 'Token is required or invalid',
        },
      },
    },
  })
  async verify(@Query('token') token: string): Promise<BaseApiResponse<null>> {
    if (!token) {
      throw new BadRequestException('Token is required');
    }
    const user = await this.authService.verifyEmail(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }
    return {
      status: 'success',
      data: null,
      message: 'Email verified successfully.',
      error: null,
    };
  }
}
