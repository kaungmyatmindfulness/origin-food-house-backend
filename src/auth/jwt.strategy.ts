import { ExtractJwt, Strategy } from 'passport-jwt';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';

import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SECRET_KEY') || 'SECRET_KEY',
    });
  }

  validate(payload: JwtPayload) {
    console.log('📝 -> JwtStrategy -> validate -> payload:', payload);
    return {
      id: payload.sub,
      shopId: payload.shopId,
      role: payload.role,
    };
  }
}
