import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("REDIS_HOST", "localhost");
    const port = this.configService.get<number>("REDIS_PORT", 6379);
    const password = this.configService.get<string>("REDIS_PASSWORD");

    this.client = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on("connect", () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on("error", (error) => {
      this.logger.error("Redis connection error", error.stack);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log("Redis connection closed");
  }

  async set(
    key: string,
    value: string,
    expiryMode?: "EX" | "PX",
    time?: number,
    setMode?: "NX" | "XX",
  ): Promise<"OK" | null> {
    const method = this.set.name;

    try {
      // Build arguments array for Redis SET command
      // ioredis supports: set(key, value, 'EX', seconds, 'NX')
      const args: (string | number)[] = [key, value];

      if (expiryMode && time !== undefined) {
        args.push(expiryMode, time);
      }

      if (setMode) {
        args.push(setMode);
      }

      // Call Redis set with spread arguments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (this.client.set as any)(...args);
      return result === "OK" ? "OK" : null;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to set key ${key}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    const method = this.get.name;

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`[${method}] Failed to get key ${key}`, error.stack);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    const method = this.del.name;

    try {
      return await this.client.del(key);
    } catch (error) {
      this.logger.error(`[${method}] Failed to delete key ${key}`, error.stack);
      throw error;
    }
  }

  async setOTP(
    key: string,
    value: string,
    ttlSeconds: number = 900,
  ): Promise<void> {
    const method = this.setOTP.name;

    try {
      await this.client.set(key, value, "EX", ttlSeconds);
      this.logger.log(`[${method}] OTP stored with ${ttlSeconds}s TTL: ${key}`);
    } catch (error) {
      this.logger.error(`[${method}] Failed to store OTP ${key}`, error.stack);
      throw error;
    }
  }

  async getOTP(key: string): Promise<string | null> {
    const method = this.getOTP.name;

    try {
      const value = await this.client.get(key);
      if (value) {
        this.logger.log(`[${method}] OTP retrieved: ${key}`);
      }
      return value;
    } catch (error) {
      this.logger.error(`[${method}] Failed to get OTP ${key}`, error.stack);
      throw error;
    }
  }

  async deleteOTP(key: string): Promise<boolean> {
    const method = this.deleteOTP.name;

    try {
      const result = await this.client.del(key);
      if (result > 0) {
        this.logger.log(`[${method}] OTP deleted: ${key}`);
      }
      return result > 0;
    } catch (error) {
      this.logger.error(`[${method}] Failed to delete OTP ${key}`, error.stack);
      throw error;
    }
  }

  async incrementOTPAttempts(key: string): Promise<number> {
    const method = this.incrementOTPAttempts.name;
    const attemptsKey = `${key}:attempts`;

    try {
      const attempts = await this.client.incr(attemptsKey);
      await this.client.expire(attemptsKey, 900);
      this.logger.log(
        `[${method}] OTP attempts incremented to ${attempts}: ${key}`,
      );
      return attempts;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to increment OTP attempts ${key}`,
        error.stack,
      );
      throw error;
    }
  }

  async getOTPAttempts(key: string): Promise<number> {
    const method = this.getOTPAttempts.name;
    const attemptsKey = `${key}:attempts`;

    try {
      const attempts = await this.client.get(attemptsKey);
      return attempts ? parseInt(attempts, 10) : 0;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to get OTP attempts ${key}`,
        error.stack,
      );
      throw error;
    }
  }

  async setLock(key: string, ttlSeconds: number = 300): Promise<boolean> {
    const method = this.setLock.name;

    try {
      const result = await this.client.set(
        key,
        "locked",
        "EX",
        ttlSeconds,
        "NX",
      );
      if (result === "OK") {
        this.logger.log(
          `[${method}] Distributed lock acquired: ${key} (TTL: ${ttlSeconds}s)`,
        );
        return true;
      }
      this.logger.warn(
        `[${method}] Failed to acquire lock (already exists): ${key}`,
      );
      return false;
    } catch (error) {
      this.logger.error(`[${method}] Failed to set lock ${key}`, error.stack);
      throw error;
    }
  }

  async releaseLock(key: string): Promise<void> {
    const method = this.releaseLock.name;

    try {
      await this.client.del(key);
      this.logger.log(`[${method}] Distributed lock released: ${key}`);
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to release lock ${key}`,
        error.stack,
      );
      throw error;
    }
  }

  getClient(): Redis {
    return this.client;
  }
}
