import { Response as ExpressResponse, CookieOptions } from 'express'; // Import CookieOptions
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { EmailService } from 'src/email/email.service'; // Assuming path for EmailService

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request, // Use NestJS @Request
  Res,
  UnauthorizedException,
  UseGuards,
  Logger, // Added Logger
  Inject, // For optional EmailService
  Optional, // For optional EmailService
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // Optional: For configuration
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiOkResponse, // Use more specific response decorators
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChooseStoreDto } from './dto/choose-store.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guards/local-auth.guard'; // Corrected path based on previous assumption
import { RequestWithUser } from './types'; // Corrected path based on previous assumption

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  // --- Cookie Settings (Ideally from ConfigService) ---
  private readonly cookieName = 'access_token';
  private readonly cookieOptions: CookieOptions;

  constructor(
    private authService: AuthService,
    // Inject ConfigService if using it for environment variables
    // private configService: ConfigService,
    // Inject EmailService - make it optional if not implemented yet
    @Optional() @Inject(EmailService) private emailService?: EmailService,
  ) {
    // Define cookie options (secure based on environment)
    // const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const isProduction = process.env.NODE_ENV === 'production'; // Simplified check
    this.cookieOptions = {
      httpOnly: true,
      secure: isProduction, // Use secure cookies in production
      sameSite: 'strict', // Mitigate CSRF
      // maxAge should ideally match JWT expiry, get value from AuthService constants if needed
      maxAge: 1000 * 60 * 60 * 24, // Example: 1 day (Matches JWT_EXPIRATION_MS in AuthService)
      // path: '/', // Usually defaults to /
      // domain: isProduction ? 'yourdomain.com' : undefined, // Set domain in production if needed
    };
  }

  /**
   * Step 1: Login with email/password.
   * Validates credentials, generates a basic JWT (sub=userId), sets it in an HttpOnly cookie.
   */
  @UseGuards(LocalAuthGuard) // Validates email/password, attaches user to req.user
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
    @Request() req: RequestWithUser, // req.user is populated by LocalAuthGuard (assumed { id: number, ... })
    @Body() _: LoginDto, // DTO needed for validation/Swagger, but user comes from req
    @Res({ passthrough: true }) res: ExpressResponse,
  ): BaseApiResponse<{ access_token: string }> {
    // LocalAuthGuard ensures req.user exists and is valid here
    const userId = req.user.sub;

    this.logger.log(`User ID ${userId} passed Step 1 login.`);

    // Generate the basic token (contains only user ID)
    const accessToken = this.authService.generateAccessTokenNoStore({
      id: userId,
    });

    // Set the token in an HttpOnly cookie
    res.cookie(this.cookieName, accessToken, this.cookieOptions);
    this.logger.log(`Basic access token cookie set for User ID ${userId}.`);

    // Return the token in the response body as well (common practice)
    return BaseApiResponse.success(
      { access_token: accessToken },
      'Credentials valid, requires store selection.',
    );
  }

  /**
   * Step 2: Choose a store to finalize login.
   * Requires a valid basic JWT from Step 1. Generates a new JWT (sub, storeId, role), sets it in HttpOnly cookie.
   */
  @UseGuards(JwtAuthGuard) // Ensures a valid JWT (basic or full) exists
  @Post('login/store')
  @ApiBearerAuth() // Indicate that a bearer token (in cookie) is required
  @ApiOperation({ summary: 'Select a store to complete login (Step 2)' })
  @ApiOkResponse({
    description:
      'Store selected. Full JWT set in HttpOnly cookie. Token contains { sub, storeId, role }.',
    schema: {
      example: {
        status: 'success',
        data: { access_token: 'eyJhbGciOiJIUzI1NiIsInR...' },
        message: 'Store selected, full token generated.',
        errors: null,
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid/Expired Token or User not member of store.',
  })
  @ApiNotFoundResponse({
    description: 'User/Membership data not found (should be rare).',
  })
  async loginWithStore(
    @Request() req: RequestWithUser, // req.user is populated by JwtAuthGuard (JWT payload)
    @Body() body: ChooseStoreDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<BaseApiResponse<{ access_token: string }>> {
    const userId = req.user.sub; // Get user ID from JWT 'sub' claim
    if (!userId) {
      // Should be caught by JwtAuthGuard, but safeguard anyway
      this.logger.error(
        'login/store endpoint hit without valid userId in JWT payload.',
      );
      throw new UnauthorizedException('Invalid authentication token.');
    }

    const { storeId } = body;
    this.logger.log(
      `User ID ${userId} attempting Step 2 login for Store ID ${storeId}.`,
    );

    // Generate the full token (contains user ID, store ID, role)
    const accessToken = await this.authService.generateAccessTokenWithStore(
      userId,
      storeId,
    );

    // Set the new token in an HttpOnly cookie (overwrites previous one)
    res.cookie(this.cookieName, accessToken, this.cookieOptions);
    this.logger.log(
      `Full access token cookie set for User ID ${userId}, Store ID ${storeId}.`,
    );

    return BaseApiResponse.success(
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
    type: BaseApiResponse,
  })
  @ApiBadRequestResponse({ description: 'Missing, invalid, or expired token.' })
  async verify(@Query('token') token: string): Promise<BaseApiResponse<null>> {
    if (!token) {
      throw new BadRequestException('Verification token is required.');
    }
    this.logger.log(
      `Attempting email verification for token: ${token.substring(0, 10)}...`,
    );
    const user = await this.authService.verifyEmail(token);
    if (!user) {
      // Service returns null for invalid/expired token
      throw new BadRequestException('Invalid or expired verification token.');
    }
    this.logger.log(`Email successfully verified for User ID: ${user.id}.`);
    return BaseApiResponse.success(
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
    type: BaseApiResponse,
  })
  @ApiBadRequestResponse({ description: 'Invalid request body.' }) // For DTO validation
  @ApiResponse({
    status: 500,
    description: 'Failed to initiate password reset process.',
  }) // If email sending setup fails internally
  async forgotPassword(
    @Body() body: ForgotPasswordDto,
  ): Promise<BaseApiResponse<null>> {
    this.logger.log(`Password reset requested for email: ${body.email}`);
    const result = await this.authService.forgotPassword(body.email);

    // Check if resetInfo was generated (meaning user exists) and trigger email
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
        // Do not expose email sending failure to the client, but log it.
        // The generic success message is returned regardless, as per security best practice.
      }
    } else if (result.resetInfo && !this.emailService) {
      this.logger.warn(
        `Password reset info generated for ${body.email} but EmailService is not available.`,
      );
      // Log the token/link in dev environments for testing if desired (use ConfigService)
      // if (process.env.NODE_ENV === 'dev') {
      //    this.logger.debug(`DEV ONLY: Reset token for ${body.email}: ${result.resetInfo.token}`);
      // }
    }

    // Always return the generic message for security
    return BaseApiResponse.success(null, result.message);
  }

  /**
   * Reset password using a valid token.
   */
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using reset token from email' })
  @ApiOkResponse({
    description: 'Password reset successful.',
    type: BaseApiResponse,
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
  ): Promise<BaseApiResponse<null>> {
    this.logger.log(
      `Password reset attempt for token: ${body.token.substring(0, 10)}...`,
    );
    // AuthService handles token validation/expiry and password update
    const result = await this.authService.resetPassword(
      body.token,
      body.newPassword,
    );
    return BaseApiResponse.success(null, result.message);
  }

  /**
   * Change password for an authenticated (logged-in) user.
   */
  @UseGuards(JwtAuthGuard) // Ensure user is logged in
  @Post('change-password')
  @ApiBearerAuth() // Requires JWT
  @ApiOperation({ summary: 'Change password for logged-in user' })
  @ApiOkResponse({
    description: 'Password changed successfully.',
    type: BaseApiResponse,
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
    @Request() req: RequestWithUser, // Get userId from JWT
    @Body() body: ChangePasswordDto,
  ): Promise<BaseApiResponse<null>> {
    const userId = req.user.sub; // Get user ID from 'sub' claim
    this.logger.log(`Password change attempt for User ID: ${userId}`);
    const result = await this.authService.changePassword(
      userId,
      body.oldPassword,
      body.newPassword,
    );
    // Consider clearing the cookie/forcing re-login after password change for security? Optional.
    return BaseApiResponse.success(null, result.message);
  }

  // Optional: Add a logout endpoint
  /*
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user by clearing the auth cookie' })
  @ApiOkResponse({ description: 'Logged out successfully.' })
  logout(@Res({ passthrough: true }) res: ExpressResponse): BaseApiResponse<null> {
      res.clearCookie(this.cookieName, this.cookieOptions); // Use the same options used to set it
      this.logger.log(`User logged out.`);
      return BaseApiResponse.success(null, 'Logged out successfully.');
  }
  */
}
