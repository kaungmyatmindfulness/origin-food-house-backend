import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { User } from "@prisma/client";
import { passportJwtSecret } from "jwks-rsa";
import { ExtractJwt, Strategy, StrategyOptions } from "passport-jwt";

import { PrismaService } from "src/prisma/prisma.service";
import { UserService } from "src/user/user.service";

import { Auth0Config } from "../config/auth0.config";
import { Auth0Service } from "../services/auth0.service";
import {
  Auth0TokenPayload,
  Auth0AuthenticatedUser,
} from "../types/auth0.types";

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, "auth0") {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly auth0Service: Auth0Service,
  ) {
    const auth0Config = configService.get<Auth0Config>("auth0");

    if (!auth0Config) {
      throw new Error("Auth0 configuration is missing");
    }

    const strategyOptions: StrategyOptions = {
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${auth0Config.domain}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: auth0Config.audience,
      issuer: auth0Config.issuer,
      algorithms: ["RS256"],
    };

    super(strategyOptions);
  }

  /**
   * Validate the Auth0 JWT payload and sync/create user in local database
   */
  async validate(payload: Auth0TokenPayload): Promise<Auth0AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException("Invalid token payload");
    }

    // Extract user information from Auth0 token
    const auth0UserId = payload.sub;
    const email = payload.email ?? this.extractEmailFromCustomClaim(payload);
    const emailVerified = payload.email_verified ?? false;
    const name = payload.name ?? this.extractNameFromCustomClaim(payload);

    // Find or create user in local database
    const user = await this.findOrCreateUser(
      auth0UserId,
      email,
      emailVerified,
      name,
    );

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Return user with Auth0 metadata
    return {
      ...user,
      auth0Payload: payload,
    };
  }

  /**
   * Extract email from custom Auth0 claims
   */
  private extractEmailFromCustomClaim(
    payload: Auth0TokenPayload,
  ): string | undefined {
    // Check for custom claims with namespace
    const customClaims = Object.keys(payload).filter((key) =>
      key.startsWith("https://"),
    );
    for (const claim of customClaims) {
      if (claim.includes("email")) {
        const value = payload[claim as keyof Auth0TokenPayload];
        if (typeof value === "string") {
          return value;
        }
      }
    }
    return undefined;
  }

  /**
   * Extract name from custom Auth0 claims
   */
  private extractNameFromCustomClaim(
    payload: Auth0TokenPayload,
  ): string | undefined {
    // Check for custom claims with namespace
    const customClaims = Object.keys(payload).filter((key) =>
      key.startsWith("https://"),
    );
    for (const claim of customClaims) {
      if (claim.includes("name")) {
        const value = payload[claim as keyof Auth0TokenPayload];
        if (typeof value === "string") {
          return value;
        }
      }
    }
    return undefined;
  }

  /**
   * Find or create user in local database
   */
  private async findOrCreateUser(
    auth0UserId: string,
    email: string | undefined,
    emailVerified: boolean,
    name: string | undefined,
  ): Promise<User | null> {
    // Check if user exists by Auth0 ID
    let user = await this.prisma.user.findUnique({
      where: { auth0Id: auth0UserId },
    });

    if (!user && email) {
      // Check if user exists by email
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Update existing user with Auth0 ID
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            auth0Id: auth0UserId,
            isEmailVerified: emailVerified,
            verified: emailVerified,
          },
        });
      } else {
        // Create new user
        user = await this.prisma.user.create({
          data: {
            auth0Id: auth0UserId,
            email,
            name: name ?? email.split("@")[0],
            isEmailVerified: emailVerified,
            verified: emailVerified,
          },
        });
      }
    } else if (user && emailVerified && !user.isEmailVerified) {
      // Update email verification status
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: emailVerified,
          verified: emailVerified,
        },
      });
    }

    return user;
  }
}
