import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
  Logger,
  Headers,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiHeader,
} from "@nestjs/swagger";
import { Response as ExpressResponse, CookieOptions } from "express";

import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";

import { AuthService } from "./auth.service";
import { ChooseStoreDto } from "./dto/choose-store.dto";
import { Auth0Guard } from "./guards/auth0.guard";
import { RequestWithUser } from "./types";
import { Auth0AuthenticatedUser } from "./types/auth0.types";

interface Auth0ConfigResponse {
  domain: string;
  clientId: string;
  audience: string;
  enabled: boolean;
}

interface Auth0ValidateResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

interface Auth0ProfileResponse {
  id: string;
  email: string;
  name: string | null;
  auth0Id: string | null;
  auth0Metadata: Record<string, unknown>;
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  private readonly cookieName = "access_token";
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const nodeEnv = this.configService.get<string>("NODE_ENV", "production");
    const isProduction = nodeEnv === "production";
    this.cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    };
  }

  /**
   * Choose a store after Auth0 authentication.
   * Requires a valid JWT from Auth0 validation. Generates a new JWT (sub, storeId, role), sets it in HttpOnly cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post("login/store")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Select a store to complete login" })
  @ApiOkResponse({
    description:
      "Store selected. Full JWT set in HttpOnly cookie. Token contains { sub, storeId, role }.",
    type: StandardApiResponse,
  })
  @ApiUnauthorizedResponse({
    description: "Invalid/Expired Token or User not member of store.",
  })
  @ApiNotFoundResponse({
    description: "User/Membership data not found (should be rare).",
  })
  async loginWithStore(
    @Request() req: RequestWithUser,
    @Body() body: ChooseStoreDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<StandardApiResponse<{ access_token: string }>> {
    const userId = req.user.sub;
    if (!userId) {
      this.logger.error(
        "login/store endpoint hit without valid userId in JWT payload.",
      );
      throw new UnauthorizedException("Invalid authentication token.");
    }

    const { storeId } = body;
    this.logger.log(
      `User ID ${userId} attempting login for Store ID ${storeId}.`,
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
      "Store selected, full token generated.",
    );
  }

  /**
   * Get Auth0 configuration for frontend
   */
  @Get("auth0/config")
  @ApiOperation({ summary: "Get Auth0 configuration for frontend" })
  @ApiOkResponse({
    description: "Auth0 configuration retrieved successfully",
    schema: {
      example: {
        status: "success",
        data: {
          domain: "your-tenant.auth0.com",
          clientId: "your-client-id",
          audience: "https://api.your-domain.com",
          enabled: true,
        },
      },
    },
  })
  getAuth0Config(): StandardApiResponse<Auth0ConfigResponse> {
    const auth0Config = this.configService.get<{
      domain: string;
      clientId: string;
      audience: string;
    }>("auth0");

    if (!auth0Config) {
      throw new Error("Auth0 configuration is missing");
    }

    return StandardApiResponse.success(
      {
        domain: auth0Config.domain,
        clientId: auth0Config.clientId,
        audience: auth0Config.audience,
        enabled: true,
      },
      "Auth0 configuration retrieved",
    );
  }

  /**
   * Validate Auth0 token and sync user
   */
  @Post("auth0/validate")
  @ApiOperation({ summary: "Validate Auth0 access token and sync user" })
  @ApiHeader({
    name: "Authorization",
    description: "Bearer <auth0-access-token>",
    required: true,
  })
  @ApiOkResponse({
    description: "Auth0 token validated and user synced successfully",
    schema: {
      example: {
        status: "success",
        data: {
          access_token: "jwt-token-for-backend",
          user: {
            id: "user-id",
            email: "user@example.com",
            name: "User Name",
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: "Invalid Auth0 token or Auth0 is not enabled",
  })
  async validateAuth0Token(
    @Headers("authorization") authHeader: string,
    @Res({ passthrough: true }) res: ExpressResponse,
  ): Promise<StandardApiResponse<Auth0ValidateResponse>> {
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authorization header is required");
    }

    const token = authHeader.substring(7);

    try {
      // Get user info from Auth0
      const auth0UserInfo = await this.authService.getAuth0UserInfo(token);

      // Sync user with local database
      const user = await this.authService.syncAuth0User(auth0UserInfo);

      // Generate JWT for backend
      const accessToken = this.authService.generateJwtForAuth0User(user);

      // Set cookie
      res.cookie(this.cookieName, accessToken, this.cookieOptions);

      this.logger.log(
        `Auth0 user synced and JWT generated for user ID: ${user.id}`,
      );

      return StandardApiResponse.success(
        {
          access_token: accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
          },
        },
        "Auth0 authentication successful",
      );
    } catch (error) {
      this.logger.error("Auth0 token validation failed", error);
      throw new UnauthorizedException("Invalid Auth0 token");
    }
  }

  /**
   * Auth0 protected route example
   */
  @UseGuards(Auth0Guard)
  @Get("auth0/profile")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user profile (Auth0 protected)" })
  @ApiOkResponse({
    description: "User profile retrieved successfully",
  })
  @ApiUnauthorizedResponse({
    description: "Invalid or missing Auth0 token",
  })
  getAuth0Profile(
    @Request() req: { user: Auth0AuthenticatedUser },
  ): StandardApiResponse<Auth0ProfileResponse> {
    const { user } = req;

    return StandardApiResponse.success(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        auth0Id: user.auth0Id,
        auth0Metadata: user.auth0Payload ?? {},
      },
      "Profile retrieved successfully",
    );
  }
}
