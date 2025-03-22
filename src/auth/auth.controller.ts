import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Get,
  Query,
  BadRequestException,
  UnauthorizedException,
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
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Step 1: Login with email/password.
   * Issues a JWT with userId (sub), but no shopId yet.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email/password (step 1)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a JWT containing { sub: userId }. No shopId yet.',
    schema: {
      example: {
        status: 'success',
        data: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR...',
        },
        message: 'Credentials valid, token has no shopId yet.',
        error: null,
      },
    },
  })
  login(
    @Request() req: RequestWithUser,
    @Body() _: LoginDto,
  ): BaseApiResponse<{ access_token: string }> {
    const user = req.user;

    // Step 1: Sign a token with sub=user.id
    const result = this.authService.loginNoShop(user);

    return {
      status: 'success',
      data: result,
      message: 'Credentials valid, token has no shopId yet.',
      error: null,
    };
  }

  /**
   * Step 2: After receiving a userId token, user picks a shop.
   * We create a NEW JWT that includes { sub: userId, shopId, role }.
   */
  @UseGuards(JwtAuthGuard)
  @Post('login/shop')
  @ApiOperation({ summary: 'Choose a shop to finalize login (step 2)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a new JWT with userId + shopId + role.',
    schema: {
      example: {
        status: 'success',
        data: {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR...',
        },
        message: 'Shop selected, new token generated.',
        error: null,
      },
    },
  })
  async loginWithShop(
    @Request() req: RequestWithUser,
    @Body() body: ChooseShopDto,
  ): Promise<BaseApiResponse<{ access_token: string }>> {
    const userId = req.user.id;

    if (!userId) {
      throw new UnauthorizedException(
        'No userId in token. Did you skip step 1?',
      );
    }

    const { shopId } = body;
    const result = await this.authService.loginWithShop(userId, shopId);

    return {
      status: 'success',
      data: result,
      message: 'Shop selected, new token generated.',
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
