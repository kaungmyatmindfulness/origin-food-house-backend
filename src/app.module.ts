import { AuthModule } from 'src/auth/auth.module';
import { UnusedImageCleanupService } from 'src/common/cleanup/unused-image-cleanup.service';
import { CommonModule } from 'src/common/common.module';
import { EmailModule } from 'src/email/email.module';
import { MenuModule } from 'src/menu/menu.module';
import { OrderModule } from 'src/order/order.module';
import { StoreModule } from 'src/store/store.module';
import { TableSessionModule } from 'src/table-session/table-session.module';
import { UserModule } from 'src/user/user.module';

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { APP_GUARD } from '@nestjs/core';
import { CategoryModule } from 'src/category/category.module';
import { LoggerMiddleware } from 'src/common/middleware/logger.middleware';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60 * 1000, // 1 minute
        limit: 20,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CategoryModule,
    CommonModule,
    EmailModule,
    MenuModule,
    OrderModule,
    StoreModule,
    TableSessionModule,
    UserModule,
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
