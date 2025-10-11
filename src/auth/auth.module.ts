import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';

import { UserModule } from '../user/user.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { CustomerSessionJwtStrategy } from 'src/auth/customer-session-jwt.strategy';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret =
          configService.getOrThrow<string>('JWT_SECRET') || 'JWT_SECRET';
        const expiresIn =
          configService.getOrThrow<string>('JWT_EXPIRY') || '20h';
        return {
          secret,
          signOptions: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expiresIn: expiresIn as any,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    PrismaService,
    AuthService,
    LocalStrategy,
    JwtStrategy,
    CustomerSessionJwtStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
