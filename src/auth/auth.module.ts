import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaService } from 'src/prisma/prisma.service';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import auth0Config from './config/auth0.config';
import { Auth0Service } from './services/auth0.service';
import { Auth0Strategy } from './strategies/auth0.strategy';

import type { StringValue } from 'ms';

@Module({
  imports: [
    UserModule,
    ConfigModule.forFeature(auth0Config),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret =
          configService.getOrThrow<string>('JWT_SECRET') || 'JWT_SECRET';
        const expiresIn = (configService.getOrThrow<string>('JWT_EXPIRES_IN') ||
          '20h') as StringValue;
        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    PrismaService,
    AuthService,
    Auth0Service,
    Auth0Strategy,
    JwtStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, Auth0Service, JwtModule],
})
export class AuthModule {}
