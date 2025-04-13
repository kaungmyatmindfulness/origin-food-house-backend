import { Response as ExpressResponse, CookieOptions } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { EmailService } from 'src/email/email.service';

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChooseStoreDto } from './dto/choose-store.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RequestWithUser } from './types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  private readonly cookieName = 'access_token';
  private readonly cookieOptions: CookieOptions;

  constructor(
    private authService: AuthService,

    @Optional() @Inject(EmailService) private emailService?: EmailService,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';
    this.cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    };
  }

  /**
   * Step 1: Login with email/password.
   * Validates credentials, generates a basic JWT (sub=userId), sets it in an HttpOnly cookie.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Login with email/password (Step 1)' })
  @ApiOkResponse({
    description:
      'Login successful (Step 1). Basic JWT set in HttpOnly cookie. Token only contains { sub: userId }.',
    schema: {
      example: {
        status: 'success',
        data: { access_token: 'eyJhbGciOiJIUzI1NiIsInR...' },
        message: 'Credentials valid, requires store selection.',
        errors: null,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or email not verified.',
  })
  login(
    @Request() req: RequestWithUser,
    @Body() _: LoginDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): StandardApiResponse<{ access_token: string }> {
    const userId = req.user.sub;

    this.logger.log(`User ID ${userId} passed Step 1 login.`);

    const accessToken = this.authService.generateAccessTokenNoStore({
      id: userId,
    });

    res.cookie(this.cookieName, accessToken, this.cookieOptions);
    this.logger.log(`Basic access token cookie set for User ID ${userId}.`);

    return StandardApiResponse.success(
      { access_token: accessToken },
      'Credentials valid, requires store selection.',
    );
  }

  /**
   * Step 2: Choose a store to finalize login.
   * Requires a valid basic JWT from Step 1. Generates a new JWT (sub, storeId, role), sets it in HttpOnly cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post('login/store')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select a store to complete login (Step 2)' })
  @ApiOkResponse({
    description:
      'Store selected. Full JWT set in HttpOnly cookie. Token contains { sub, storeId, role }.',
    type: StandardApiResponse,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid/Expired Token or User not member of store.',
  })
  @ApiNotFoundResponse({
    description: 'User/Membership data not found (should be rare).',
  })
  async loginWithStore(
    @Request() req: RequestWithUser,
    @Body() body: ChooseStoreDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<StandardApiResponse<{ access_token: string }>> {
    const userId = req.user.sub;
    if (!userId) {
      this.logger.error(
        'login/store endpoint hit without valid userId in JWT payload.',
      );
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const { storeId } = body;
    this.logger.log(
      `User ID ${userId} attempting Step 2 login for Store ID ${storeId}.`,
    );

    const accessToken = await this.authService.generateAccessTokenWithStore(
      userId,
      storeId,
    );

    res.cookie(this.cookieName, accessToken, this.cookieOptions);
    this.logger.log(
      `Full access token cookie set for User ID ${userId}, Store ID ${storeId}.`,
    );

    return StandardApiResponse.success(
      { access_token: accessToken },
      'Store selected, full token generated.',
    );
  }

  /**
   * Verify user email via token from query parameter.
   */
  @Get('verify')
  @ApiOperation({ summary: 'Verify user email using token from email link' })
  @ApiQuery({
    name: 'token',
    required: true,
    type: String,
    description: 'Verification token',
  })
  @ApiOkResponse({
    description: 'Email verified successfully.',
    type: StandardApiResponse,
  })
  @ApiBadRequestResponse({ description: 'Missing, invalid, or expired token.' })
  async verify(
    @Query('token') token: string,
  ): Promise<StandardApiResponse<null>> {
    if (!token) {
      throw new BadRequestException('Verification token is required.');
    }
    this.logger.log(
      `Attempting email verification for token: ${token.substring(0, 10)}...`,
    );
    const user = await this.authService.verifyEmail(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification token.');
    }
    this.logger.log(`Email successfully verified for User ID: ${user.id}.`);
    return StandardApiResponse.success(
      null,
      'Email verified successfully. You can now log in.',
    );
  }

  /**
   * Request a password reset email.
   */
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset token via email' })
  @ApiOkResponse({
    description:
      'If the email exists, a reset token is generated and an email is queued.',
    type: StandardApiResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  @ApiResponse({
    status: 500,
    description: 'Failed to initiate password reset process.',
  })
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<StandardApiResponse<null>> {
    this.logger.log(`Password reset requested for email: ${body.email}`);
    const result = await this.authService.forgotPassword(body.email);

    if (result.resetInfo && this.emailService) {
      try {
        await this.emailService.sendPasswordResetEmail(
          result.resetInfo.email,
          result.resetInfo.token,
        );
        this.logger.log(
          `Password reset email queued for ${result.resetInfo.email}.`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send password reset email to ${result.resetInfo.email}`,
          error,
        );
      }
    } else if (result.resetInfo && !this.emailService) {
      this.logger.warn(
        `Password reset info generated for ${body.email} but EmailService is not available.`,
      );
    }

    return StandardApiResponse.success(null, result.message);
  }

  /**
   * Reset password using a valid token.
   */
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token from email' })
  @ApiOkResponse({
    description: 'Password reset successful.',
    type: StandardApiResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid/expired token or validation errors.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal error during password reset.',
  })
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<StandardApiResponse<null>> {
    this.logger.log(
      `Password reset attempt for token: ${body.token.substring(0, 10)}...`,
    );

    const result = await this.authService.resetPassword(
      body.token,
      body.newPassword,
    );
    return StandardApiResponse.success(null, result.message);
  }

  /**
   * Change password for an authenticated (logged-in) user.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for logged-in user' })
  @ApiOkResponse({
    description: 'Password changed successfully.',
    type: StandardApiResponse,
  })
  @ApiBadRequestResponse({
    description: 'Validation errors (e.g., new password same as old).',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid old password.' })
  @ApiNotFoundResponse({
    description: 'User not found (should not happen with valid JWT).',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal error during password change.',
  })
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() body: ChangePasswordDto,
  ): Promise<StandardApiResponse<null>> {
    const userId = req.user.sub;
    this.logger.log(`Password change attempt for User ID: ${userId}`);
    const result = await this.authService.changePassword(
      userId,
      body.oldPassword,
      body.newPassword,
    );

    return StandardApiResponse.success(null, result.message);
  }
}
