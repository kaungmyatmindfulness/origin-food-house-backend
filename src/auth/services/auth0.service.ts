import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  expressjwt,
  GetVerificationKey,
  Request as JWTRequest,
} from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';

import { Auth0Config } from '../config/auth0.config';
import {
  Auth0UserInfo,
  Auth0TokenPayload,
  Auth0UserCreateData,
  Auth0ManagementApiError,
} from '../types/auth0.types';

@Injectable()
export class Auth0Service {
  private readonly logger = new Logger(Auth0Service.name);
  private readonly auth0Config: Auth0Config;
  private readonly jwtCheck: ReturnType<typeof expressjwt>;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<Auth0Config>('auth0');

    if (!config) {
      throw new Error('Auth0 configuration is missing');
    }

    this.auth0Config = config;

    // Configure JWT validation middleware
    this.jwtCheck = expressjwt({
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${this.auth0Config.domain}/.well-known/jwks.json`,
      }) as GetVerificationKey,
      audience: this.auth0Config.audience,
      issuer: this.auth0Config.issuer,
      algorithms: ['RS256'],
    });
  }

  /**
   * Validate an Auth0 JWT token
   */
  async validateToken(token: string): Promise<Auth0TokenPayload> {
    return await new Promise((resolve, reject) => {
      // Create a mock request object for express-jwt
      const mockReq: JWTRequest = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        // Add minimal required properties for JWTRequest
        auth: undefined,
      } as JWTRequest;

      // Create mock response - express-jwt doesn't use it
      const mockRes = {} as Parameters<typeof this.jwtCheck>[1];

      // Execute the JWT check middleware
      void this.jwtCheck(mockReq, mockRes, (error) => {
        if (error) {
          this.logger.error('JWT validation failed', error);
          reject(new UnauthorizedException('Invalid Auth0 token'));
          return;
        }

        if (!mockReq.auth) {
          this.logger.error('No auth payload after validation');
          reject(new UnauthorizedException('Token validation failed'));
          return;
        }

        resolve(mockReq.auth as Auth0TokenPayload);
      });
    });
  }

  /**
   * Get user information from Auth0
   */
  async getUserInfo(accessToken: string): Promise<Auth0UserInfo> {
    try {
      const response = await fetch(
        `https://${this.auth0Config.domain}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to fetch user info from Auth0: ${response.status} - ${errorText}`,
        );
        throw new Error('Failed to fetch user info from Auth0');
      }

      const userInfo = (await response.json()) as Auth0UserInfo;
      return userInfo;
    } catch (error) {
      this.logger.error('Failed to get user information from Auth0', error);
      throw new UnauthorizedException(
        'Failed to get user information from Auth0',
      );
    }
  }

  /**
   * Create or update a user in the Auth0 Management API
   * Note: This requires a Management API token with appropriate scopes
   */
  async createOrUpdateUser(
    email: string,
    userData: Partial<Auth0UserCreateData>,
  ): Promise<Auth0UserInfo> {
    if (!this.auth0Config.managementApiToken) {
      throw new Error('Auth0 Management API token is not configured');
    }

    const createUserData: Auth0UserCreateData = {
      connection: 'Username-Password-Authentication',
      email,
      ...userData,
    };

    try {
      const response = await fetch(
        `https://${this.auth0Config.domain}/api/v2/users`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.auth0Config.managementApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createUserData),
        },
      );

      if (!response.ok) {
        const error = (await response.json()) as Auth0ManagementApiError;
        this.logger.error(`Failed to create user in Auth0: ${error.message}`);
        throw new Error(`Failed to create user in Auth0: ${error.message}`);
      }

      const createdUser = (await response.json()) as Auth0UserInfo;
      return createdUser;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to create or update user in Auth0: ${errorMessage}`,
      );
      throw new Error(
        `Failed to create or update user in Auth0: ${errorMessage}`,
      );
    }
  }

  /**
   * Get Auth0 configuration
   */
  getConfig(): Auth0Config {
    return this.auth0Config;
  }
}
