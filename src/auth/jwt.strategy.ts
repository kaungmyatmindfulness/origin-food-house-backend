import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { JwtPayload } from './interfaces/jwt-payload.interface';

function extractJwtFromCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined>;
  const token = cookies['access_token'];
  return token || null;
}
/**
 * Combined extractor:
 * 1) Try Bearer from header,
 * 2) if null, try the "access_token" cookie.
 */
function jwtExtractor(req: Request): string | null {
  // Step 1: Try from Authorization header
  const authHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (authHeader) {
    return authHeader;
  }
  // Step 2: Fall back to cookie
  return extractJwtFromCookie(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: jwtExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SECRET_KEY') || 'SECRET_KEY',
    });
  }

  validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      storeId: payload.storeId,
      role: payload.role,
    };
  }
}
