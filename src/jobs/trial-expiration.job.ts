import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { getErrorDetails } from "../common/utils/error.util";
import { SubscriptionEmailService } from "../email/subscription-email.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class TrialExpirationJob {
  private readonly logger = new Logger(TrialExpirationJob.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly emailService: SubscriptionEmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3002",
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTrialExpiration(): Promise<void> {
    const method = this.handleTrialExpiration.name;
    const lockKey = "job:trial-expiration";

    const lock = await this.redis.setLock(lockKey, 300);

    if (!lock) {
      this.logger.warn(`[${method}] Job already running (lock exists)`);
      return;
    }

    try {
      this.logger.log(`[${method}] Starting trial expiration check`);
      const startTime = Date.now();

      const { warningCount, downgradeCount } =
        await this.processTrialExpirations();

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${method}] Completed in ${duration}ms (warnings: ${warningCount}, downgrades: ${downgradeCount})`,
      );
    } catch (error) {
      const { message, stack } = getErrorDetails(error);
      this.logger.error(`[${method}] Job failed: ${message}`, stack);
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private async processTrialExpirations(): Promise<{
    warningCount: number;
    downgradeCount: number;
  }> {
    const method = this.processTrialExpirations.name;

    const warningCount = await this.sendTrialWarnings();
    this.logger.log(`[${method}] Sent ${warningCount} trial warnings`);

    const downgradeCount = await this.autoDowngradeExpiredTrials();
    this.logger.log(
      `[${method}] Auto-downgraded ${downgradeCount} expired trials`,
    );

    return { warningCount, downgradeCount };
  }

  private async sendTrialWarnings(): Promise<number> {
    const method = this.sendTrialWarnings.name;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const trialsExpiringSoon = await this.prisma.subscription.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: {
          gte: now,
          lte: sevenDaysFromNow,
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

    let warningCount = 0;

    for (const subscription of trialsExpiringSoon) {
      try {
        const owner = subscription.store.userStores[0]?.user;
        if (!owner?.email) {
          this.logger.warn(
            `[${method}] No owner found for subscription ${subscription.id}`,
          );
          continue;
        }

        const { trialEndsAt } = subscription;
        if (!trialEndsAt) continue;

        const daysRemaining = Math.ceil(
          (trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        if (daysRemaining === 7 || daysRemaining === 1) {
          await this.emailService.sendTrialWarning(owner.email, {
            ownerName: owner.name ?? "User",
            storeName: subscription.store.information?.name ?? "Your Store",
            daysRemaining,
            trialEndsAt: trialEndsAt.toLocaleDateString(),
            upgradeUrl: `${this.frontendUrl}/stores/${subscription.storeId}/settings/subscription`,
            year: new Date().getFullYear(),
          });

          this.logger.log(
            `[${method}] Sent ${daysRemaining}-day warning to ${owner.email} for subscription ${subscription.id}`,
          );

          warningCount++;
        }
      } catch (error) {
        this.logger.error(
          `[${method}] Failed to send warning for subscription ${subscription.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return warningCount;
  }

  private async autoDowngradeExpiredTrials(): Promise<number> {
    const method = this.autoDowngradeExpiredTrials.name;

    const now = new Date();
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: {
          lt: now,
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

    let downgradeCount = 0;

    for (const subscription of expiredTrials) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              tier: "FREE",
              status: "ACTIVE",
              trialEndsAt: null,
              trialStartedAt: null,
              currentPeriodStart: now,
              currentPeriodEnd: null,
            },
          });

          await tx.auditLog.create({
            data: {
              storeId: subscription.storeId,
              action: "TIER_AUTO_DOWNGRADED",
              entityType: "Subscription",
              entityId: subscription.id,
              details: {
                previousTier: subscription.tier,
                newTier: "FREE",
                reason: "Trial expired",
              },
            },
          });
        });

        const owner = subscription.store.userStores[0]?.user;
        if (owner?.email) {
          await this.emailService.sendTrialExpired(owner.email, {
            ownerName: owner.name ?? "User",
            storeName: subscription.store.information?.name ?? "Your Store",
            downgradedAt: now.toLocaleDateString(),
            upgradeUrl: `${this.frontendUrl}/stores/${subscription.storeId}/settings/subscription`,
            year: new Date().getFullYear(),
          });

          this.logger.log(
            `[${method}] Sent trial expired email to ${owner.email} for subscription ${subscription.id}`,
          );
        }

        downgradeCount++;
        this.logger.log(
          `[${method}] Auto-downgraded subscription ${subscription.id} from ${subscription.tier} to FREE`,
        );
      } catch (error) {
        this.logger.error(
          `[${method}] Failed to downgrade subscription ${subscription.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return downgradeCount;
  }
}
