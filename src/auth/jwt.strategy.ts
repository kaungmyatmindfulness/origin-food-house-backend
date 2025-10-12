import { Injectable, Logger } from '@nestjs/common'; // Import Logger
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { JwtPayload } from './interfaces/jwt-payload.interface'; // Assuming this interface exists

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

  constructor(private readonly configService: ConfigService) {
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
   * @param payload The decoded JWT payload.
   * @returns The object to be attached to `req.user`.
   */
  validate(payload: JwtPayload): { sub: string } {
    this.logger.verbose(`Validating JWT payload for User ID: ${payload?.sub}`);

    if (!payload || typeof payload.sub !== 'string') {
      this.logger.warn(
        'JWT payload validation encountered unexpected structure or missing fields.',
        payload,
      );
    }

    const userPayload = {
      sub: payload.sub,
    };

    this.logger.verbose(
      `JWT validation successful for User ID: ${userPayload.sub}`,
    );
    return userPayload;
  }
}
