import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class OTPCleanupJob {
  private readonly logger = new Logger(OTPCleanupJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron("0 * * * *")
  async handleOTPCleanup(): Promise<void> {
    const method = this.handleOTPCleanup.name;
    const lockKey = "job:otp-cleanup";

    const lock = await this.redis.setLock(lockKey, 300);

    if (!lock) {
      this.logger.warn(`[${method}] Job already running (lock exists)`);
      return;
    }

    try {
      this.logger.log(`[${method}] Starting OTP cleanup`);
      const startTime = Date.now();

      const cleanupCount = await this.cleanupExpiredOTPs();

      const duration = Date.now() - startTime;
      this.logger.log(
        `[${method}] Completed in ${duration}ms (cleaned: ${cleanupCount} expired OTPs)`,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Job failed: ${error.message}`,
        error.stack,
      );
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  private async cleanupExpiredOTPs(): Promise<number> {
    const method = this.cleanupExpiredOTPs.name;

    const now = new Date();
    const expiredTransfers = await this.prisma.ownershipTransfer.findMany({
      where: {
        status: "PENDING_OTP",
        otpExpiresAt: {
          lt: now,
        },
      },
    });

    let cleanupCount = 0;

    for (const transfer of expiredTransfers) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.ownershipTransfer.update({
            where: { id: transfer.id },
            data: {
              status: "EXPIRED",
            },
          });

          await tx.auditLog.create({
            data: {
              storeId: transfer.storeId,
              action: "OWNERSHIP_TRANSFER_INITIATED",
              entityType: "OwnershipTransfer",
              entityId: transfer.id,
              details: {
                reason: "OTP expired - auto-cleanup",
                otpExpiresAt: transfer.otpExpiresAt,
              },
            },
          });
        });

        const otpKey = `otp:transfer:${transfer.id}`;
        await this.redis.deleteOTP(otpKey);

        cleanupCount++;
        this.logger.log(
          `[${method}] Cleaned up expired OTP for transfer ${transfer.id}`,
        );
      } catch (error) {
        this.logger.error(
          `[${method}] Failed to cleanup OTP for transfer ${transfer.id}: ${error.message}`,
          error.stack,
        );
      }
    }

    return cleanupCount;
  }
}
