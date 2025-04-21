import { Module } from '@nestjs/common';
import { ActiveTableSessionService } from './active-table-session.service';
import { ActiveTableSessionController } from './active-table-session.controller';
import { AuthModule } from '../auth/auth.module';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    AuthModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET') || 'JWT_SECRET',
        signOptions: {
          expiresIn: configService.getOrThrow<string>('JWT_EXPIRY') || '20h',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ActiveTableSessionController],
  providers: [ActiveTableSessionService, PrismaService],
  exports: [ActiveTableSessionService],
})
export class ActiveTableSessionModule {}
