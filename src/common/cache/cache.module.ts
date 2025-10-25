import { Global, Module } from '@nestjs/common';

import { CacheService } from './cache.service';

/**
 * CacheModule provides Redis-based caching globally
 * Marked as @Global() so CacheService can be injected anywhere without importing
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
