import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { getErrorDetails } from "../common/utils/error.util";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class UsageReportJob {
  private readonly logger = new Logger(UsageReportJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron("0 1 1 * *")
  async handleUsageReport(): Promise<void> {
    const method = this.handleUsageReport.name;
    const lockKey = "job:usage-report";

    const lock = await this.redis.setLock(lockKey, 600);

    if (!lock) {
      this.logger.warn(`[${method}] Job already running (lock exists)`);
      return;
    }

    try {
      this.logger.log(`[${method}] Starting monthly usage report generation`);
      const startTime = Date.now();

      const report = await this.generateUsageReport();

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${method}] Completed in ${duration}ms. Generated report for ${report.totalStores} stores`,
      );
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Job failed: ${message}`, stack);
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private async generateUsageReport(): Promise<{
    totalStores: number;
    tierDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
  }> {
    const method = this.generateUsageReport.name;

    const subscriptions = await this.prisma.subscription.findMany({
      include: {
        store: {
          include: {
            information: true,
          },
        },
      },
    });

    const tierDistribution: Record<string, number> = {
      FREE: 0,
      STANDARD: 0,
      PREMIUM: 0,
    };

    const statusDistribution: Record<string, number> = {
      TRIAL: 0,
      ACTIVE: 0,
      EXPIRED: 0,
      CANCELLED: 0,
      SUSPENDED: 0,
    };

    for (const subscription of subscriptions) {
      tierDistribution[subscription.tier] =
        (tierDistribution[subscription.tier] || 0) + 1;
      statusDistribution[subscription.status] =
        (statusDistribution[subscription.status] || 0) + 1;
    }

    const report = {
      totalStores: subscriptions.length,
      tierDistribution,
      statusDistribution,
      generatedAt: new Date().toISOString(),
    };

    this.logger.log(
      `[${method}] Usage Report: ${JSON.stringify(report, null, 2)}`,
    );

    return report;
  }
}
