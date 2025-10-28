import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { OTPCleanupJob } from "./otp-cleanup.job";
import { SubscriptionRenewalJob } from "./subscription-renewal.job";
import { TrialExpirationJob } from "./trial-expiration.job";
import { UsageReportJob } from "./usage-report.job";
import { EmailModule } from "../email/email.module";
import { PrismaService } from "../prisma/prisma.service";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
          password: configService.get<string>("REDIS_PASSWORD"),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: "email",
    }),
    RedisModule,
    EmailModule,
  ],
  providers: [
    PrismaService,
    TrialExpirationJob,
    OTPCleanupJob,
    SubscriptionRenewalJob,
    UsageReportJob,
  ],
  exports: [
    TrialExpirationJob,
    OTPCleanupJob,
    SubscriptionRenewalJob,
    UsageReportJob,
  ],
})
export class JobsModule {}
