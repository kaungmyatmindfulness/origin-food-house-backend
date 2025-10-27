import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

function extractJwtFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string>;
  const token = cookies?.['access_token'];
  return token || null;
}

/**
 * Combined extractor:
 * 1) Try Bearer from header,
 * 2) if null, try the "access_token" cookie.
 */
function jwtExtractor(req: Request): string | null {
  const authHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (authHeader) {
    return authHeader;
  }
  return extractJwtFromCookie(req);
}

// --- Strategy ---

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    let effectiveSecret = secret;
    let isFallbackSecret = false;

    if (!secret) {
      effectiveSecret = 'JWT_SECRET';
      isFallbackSecret = true;
    }

    super({
      jwtFromRequest: jwtExtractor,
      ignoreExpiration: false,
      secretOrKey: effectiveSecret!,
    });

    if (isFallbackSecret) {
      this.logger.error(
        '!!! SECURITY ALERT: JWT_SECRET not found in environment variables. Using insecure default fallback "JWT_SECRET". Configure JWT_SECRET immediately! !!!',
      );
    } else {
      this.logger.log('JWT Strategy initialized with configured JWT_SECRET.');
    }
    this.logger.log('JWT Strategy constructor finished.');
  }

  /**
   * Validates the token payload after signature/expiration check.
   * Also checks user suspension status and JWT version for invalidation.
   * @param payload The decoded JWT payload.
   * @returns The object to be attached to `req.user`.
   */
  async validate(payload: JwtPayload): Promise<{ sub: string }> {
    const method = this.validate.name;
    this.logger.verbose(
      `[${method}] Validating JWT payload for User ID: ${payload?.sub}`,
    );

    if (!payload || typeof payload.sub !== 'string') {
      this.logger.warn(
        `[${method}] JWT payload validation encountered unexpected structure or missing fields.`,
        payload,
      );
      throw new UnauthorizedException('Invalid token payload');
    }

    // Fetch user from database to check suspension and JWT version
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { jwtVersion: true, isSuspended: true, suspendedReason: true },
    });

    if (!user) {
      this.logger.warn(`[${method}] User not found: ${payload.sub}`);
      throw new UnauthorizedException('User not found');
    }

    // Check if user is suspended
    if (user.isSuspended) {
      this.logger.warn(
        `[${method}] Suspended user attempted authentication: ${payload.sub}`,
      );
      throw new UnauthorizedException(
        `User account is suspended${user.suspendedReason ? `: ${user.suspendedReason}` : ''}`,
      );
    }

    // Check JWT version for invalidation (if version provided in token)
    if (
      payload.jwtVersion !== undefined &&
      payload.jwtVersion !== user.jwtVersion
    ) {
      this.logger.warn(
        `[${method}] JWT version mismatch for user ${payload.sub}: token=${payload.jwtVersion}, db=${user.jwtVersion}`,
      );
      throw new UnauthorizedException(
        'Token has been invalidated. Please login again.',
      );
    }

    const userPayload = {
      sub: payload.sub,
    };

    this.logger.verbose(
      `[${method}] JWT validation successful for User ID: ${userPayload.sub}`,
    );
    return userPayload;
  }
}
