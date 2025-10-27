import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';

import { TierController } from './tier.controller';
import { TierService } from './tier.service';
import { CacheModule } from '../common/cache/cache.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [forwardRef(() => AuthModule), CacheModule],
  controllers: [TierController],
  providers: [TierService, PrismaService],
  exports: [TierService],
})
export class TierModule {}
