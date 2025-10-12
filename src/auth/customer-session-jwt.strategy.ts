import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';

interface SessionJwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

export interface SessionContext {
  sessionId: string;
}

const cookieExtractor = (req: Request): string | null => {
  const cookies = req.cookies as Record<string, string>;
  const token = cookies?.['session_token'];
  return token || null;
};

@Injectable()
export class CustomerSessionJwtStrategy extends PassportStrategy(
  Strategy,
  'customer-session-jwt',
) {
  private readonly logger = new Logger(CustomerSessionJwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
    this.logger.log('CustomerSessionJwtStrategy initialized');
  }

  validate(payload: SessionJwtPayload): SessionContext {
    this.logger.debug(
      `Validating session token payload: ${JSON.stringify(payload)}`,
    );
    if (!payload || typeof payload.sub !== 'string') {
      this.logger.warn(
        'Invalid session token payload received (missing or invalid sub).',
      );
      throw new UnauthorizedException('Invalid session token payload.');
    }
    const context: SessionContext = { sessionId: payload.sub };
    this.logger.verbose(
      `Session token validated successfully for sessionId: ${context.sessionId}`,
    );
    return context;
  }
}
