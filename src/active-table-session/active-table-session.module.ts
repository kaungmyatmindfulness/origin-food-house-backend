import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaService } from 'src/prisma/prisma.service';

import { ActiveTableSessionController } from './active-table-session.controller';
import { ActiveTableSessionService } from './active-table-session.service';
import { AuthModule } from '../auth/auth.module';

import type { StringValue } from 'ms';

@Module({
  imports: [
    AuthModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret =
          configService.getOrThrow<string>('JWT_SECRET') || 'JWT_SECRET';
        const expiresIn = (configService.getOrThrow<string>('JWT_EXPIRY') ||
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
  controllers: [ActiveTableSessionController],
  providers: [ActiveTableSessionService, PrismaService],
  exports: [ActiveTableSessionService],
})
export class ActiveTableSessionModule {}
