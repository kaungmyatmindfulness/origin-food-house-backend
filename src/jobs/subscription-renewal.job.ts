import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { getErrorDetails } from "../common/utils/error.util";
import { SubscriptionEmailService } from "../email/subscription-email.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class SubscriptionRenewalJob {
  private readonly logger = new Logger(SubscriptionRenewalJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailService: SubscriptionEmailService,
  ) {}

  @Cron("0 9 * * *")
  async handleSubscriptionRenewal(): Promise<void> {
    const method = this.handleSubscriptionRenewal.name;
    const lockKey = "job:subscription-renewal";

    const lock = await this.redis.setLock(lockKey, 300);

    if (!lock) {
      this.logger.warn(`[${method}] Job already running (lock exists)`);
      return;
    }

    try {
      this.logger.log(`[${method}] Starting subscription renewal check`);
      const startTime = Date.now();

      const reminderCount = await this.sendRenewalReminders();

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${method}] Completed in ${duration}ms (reminders: ${reminderCount})`,
      );
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Job failed: ${message}`, stack);
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private async sendRenewalReminders(): Promise<number> {
    const method = this.sendRenewalReminders.name;

    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const subscriptionsExpiringSoon = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        tier: {
          in: ["STANDARD", "PREMIUM"],
        },
        currentPeriodEnd: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        store: {
          include: {
            information: true,
            userStores: {
              where: {
                role: "OWNER",
              },
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    let reminderCount = 0;

    for (const subscription of subscriptionsExpiringSoon) {
      try {
        const owner = subscription.store.userStores[0]?.user;
        if (!owner?.email) {
          this.logger.warn(
            `[${method}] No owner found for subscription ${subscription.id}`,
          );
          continue;
        }

        const periodEnd = subscription.currentPeriodEnd;
        if (!periodEnd) continue;

        const daysUntilExpiry = Math.ceil(
          (periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        if (daysUntilExpiry === 30 || daysUntilExpiry === 7) {
          this.logger.log(
            `[${method}] Sending ${daysUntilExpiry}-day renewal reminder to ${owner.email} for subscription ${subscription.id}`,
          );

          reminderCount++;
        }
      } catch (error) {
        const { message, stack } = getErrorDetails(error);
        this.logger.error(
          `[${method}] Failed to send renewal reminder for subscription ${subscription.id}: ${message}`,
          stack,
        );
      }
    }

    return reminderCount;
  }
}
