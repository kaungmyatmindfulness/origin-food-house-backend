import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  expressjwt,
  GetVerificationKey,
  Request as JWTRequest,
} from "express-jwt";
import * as jwksRsa from "jwks-rsa";

import { AdminAuth0Config } from "../config/admin-auth0.config";

export interface AdminAuth0TokenPayload {
  sub: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
  aud: string | string[];
  iss: string;
  iat: number;
  exp: number;
  azp?: string;
  scope?: string;
}

export interface AdminAuth0UserInfo {
  sub: string;
  email: string;
  name?: string;
  email_verified?: boolean;
  picture?: string;
  updated_at?: string;
}

@Injectable()
export class AdminAuth0Service {
  private readonly logger = new Logger(AdminAuth0Service.name);
  private readonly adminAuth0Config: AdminAuth0Config;
  private readonly jwtCheck: ReturnType<typeof expressjwt>;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<AdminAuth0Config>("adminAuth0");

    if (!config) {
      throw new Error("Admin Auth0 configuration is missing");
    }

    this.adminAuth0Config = config;

    // Configure JWT validation middleware for admin tenant
    this.jwtCheck = expressjwt({
      secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${this.adminAuth0Config.domain}/.well-known/jwks.json`,
      }) as GetVerificationKey,
      audience: this.adminAuth0Config.audience,
      issuer: this.adminAuth0Config.issuer,
      algorithms: ["RS256"],
    });

    this.logger.log(
      `Admin Auth0 Service initialized for domain: ${this.adminAuth0Config.domain}`,
    );
  }

  async validateToken(token: string): Promise<AdminAuth0TokenPayload> {
    const method = this.validateToken.name;

    return await new Promise((resolve, reject) => {
      const mockReq: JWTRequest = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        auth: undefined,
      } as JWTRequest;

      const mockRes = {} as Parameters<typeof this.jwtCheck>[1];

      void this.jwtCheck(mockReq, mockRes, (error) => {
        if (error) {
          this.logger.error(
            `[${method}] Admin JWT validation failed`,
            error instanceof Error ? error.stack : String(error),
          );
          reject(new UnauthorizedException("Invalid admin Auth0 token"));
          return;
        }

        if (!mockReq.auth) {
          this.logger.error(`[${method}] No auth payload after validation`);
          reject(new UnauthorizedException("Admin token validation failed"));
          return;
        }

        this.logger.log(
          `[${method}] Admin token validated successfully for ${mockReq.auth.sub}`,
        );

        resolve(mockReq.auth as AdminAuth0TokenPayload);
      });
    });
  }

  async getUserInfo(accessToken: string): Promise<AdminAuth0UserInfo> {
    const method = this.getUserInfo.name;

    try {
      const response = await fetch(
        `https://${this.adminAuth0Config.domain}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[${method}] Failed to fetch admin user info from Auth0: ${response.status} - ${errorText}`,
        );
        throw new Error("Failed to fetch admin user info from Auth0");
      }

      const userInfo = (await response.json()) as AdminAuth0UserInfo;

      this.logger.log(
        `[${method}] Admin user info retrieved for ${userInfo.email}`,
      );

      return userInfo;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get admin user information from Auth0`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new UnauthorizedException(
        "Failed to get admin user information from Auth0",
      );
    }
  }

  getConfig(): AdminAuth0Config {
    return this.adminAuth0Config;
  }
}
