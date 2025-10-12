import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ActiveTableSessionModule } from 'src/active-table-session/active-table-session.module';
import { AuthModule } from 'src/auth/auth.module';
import { CartModule } from 'src/cart/cart.module';
import { CategoryModule } from 'src/category/category.module';
import { UnusedImageCleanupService } from 'src/common/cleanup/unused-image-cleanup.service';
import { CommonModule } from 'src/common/common.module';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';
import { EmailModule } from 'src/email/email.module';
import { MenuModule } from 'src/menu/menu.module';
import { StoreModule } from 'src/store/store.module';
import { TableModule } from 'src/table/table.module';
import { UserModule } from 'src/user/user.module';

import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60 * 1000, // 1 minute
        limit: 60, // 60 requests per minute
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    CategoryModule,
    CommonModule,
    EmailModule,
    MenuModule,
    StoreModule,
    UserModule,
    TableModule,
    ActiveTableSessionModule,
    CartModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    PrismaService,
    UnusedImageCleanupService,
  ],
  exports: [PrismaService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
