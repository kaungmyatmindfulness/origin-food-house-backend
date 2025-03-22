import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  Request,
  Body,
  Query,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ChooseShopDto } from './dto/choose-shop.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Step 1: Login with email/password.
   * Issues a JWT with userId (sub) but no shopId.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email/password (Step 1)' })
  @ApiResponse({
    status: 200,
    description:
      'Returns a JWT containing { sub: userId }. The token does not include shopId.',
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
    const result = this.authService.loginNoShop(user);
    return {
      status: 'success',
      data: result,
      message: 'Credentials valid, token has no shopId yet.',
      error: null,
    };
  }

  /**
   * Step 2: Choose a shop to finalize login.
   * Returns a new JWT with userId, shopId, and role.
   */
  @UseGuards(JwtAuthGuard)
  @Post('login/shop')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select a shop to complete login (Step 2)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a new JWT containing { sub: userId, shopId, role }.',
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

  /**
   * Verify user email.
   * Expects a query parameter "token".
   */
  @Get('verify')
  @ApiOperation({ summary: 'Verify user email' })
  @ApiQuery({
    name: 'token',
    required: true,
    type: String,
    description: 'Verification token from email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully.',
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
    description: 'Missing or invalid token.',
    schema: {
      example: {
        status: 'error',
        data: null,
        message: 'Invalid or expired token',
        error: { code: 'BAD_REQUEST', message: 'Token is required or invalid' },
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

  /**
   * Request a password reset.
   * Accepts email and returns a generic success message.
   */
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset token via email' })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset token is generated and emailed.',
    schema: {
      example: {
        status: 'success',
        data: null,
        message: 'Reset token generated. Please check your email.',
        error: null,
      },
    },
  })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<BaseApiResponse<null>> {
    const result = await this.authService.forgotPassword(body.email);
    return {
      status: 'success',
      data: null,
      message: result.message,
      error: null,
    };
  }

  /**
   * Reset password using a valid reset token.
   */
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful. You can now log in.',
    schema: {
      example: {
        status: 'success',
        data: null,
        message: 'Password reset successful. You can now log in.',
        error: null,
      },
    },
  })
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<BaseApiResponse<null>> {
    const result = await this.authService.resetPassword(
      body.token,
      body.newPassword,
    );
    return {
      status: 'success',
      data: null,
      message: result.message,
      error: null,
    };
  }

  /**
   * Change password for an authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for logged-in user' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      example: {
        status: 'success',
        data: null,
        message: 'Password changed successfully',
        error: null,
      },
    },
  })
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() body: ChangePasswordDto,
  ): Promise<BaseApiResponse<null>> {
    const userId = req.user.id;
    const result = await this.authService.changePassword(
      userId,
      body.oldPassword,
      body.newPassword,
    );
    return {
      status: 'success',
      data: null,
      message: result.message,
      error: null,
    };
  }
}
