import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * CacheService provides Redis-based caching for application data
 * Gracefully degrades to no-caching if Redis is unavailable
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   * If Redis URL is not provided or connection fails, service will work without caching
   */
  private initializeRedis(): void {
    const method = this.initializeRedis.name;
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn(
        `[${method}] REDIS_URL not configured - caching disabled (degraded mode)`,
      );
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redis.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`[${method}] Redis connected successfully`);
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        this.logger.error(
          `[${method}] Redis connection error`,
          error instanceof Error ? error.stack : String(error),
        );
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        this.logger.warn(`[${method}] Redis connection closed`);
      });
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to initialize Redis`,
        error instanceof Error ? error.stack : String(error),
      );
      this.redis = null;
    }
  }

  /**
   * Get cached value by key
   * @param key - Cache key
   * @returns Parsed value or null if not found/unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis || !this.isConnected) {
      return null;
    }

    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.error(
        `Failed to get cache key: ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * Set cache value with TTL
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds (default 300 = 5 minutes)
   */
  async set(
    key: string,
    value: unknown,
    ttlSeconds: number = 300,
  ): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(
        `Failed to set cache key: ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Delete cache key
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(
        `Failed to delete cache key: ${key}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Invalidate all cache keys matching a pattern
   * @param pattern - Redis key pattern (e.g., "report:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis || !this.isConnected) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(
          `Invalidated ${keys.length} cache keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to invalidate pattern: ${pattern}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Check if Redis is connected and available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.isConnected;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }
}
