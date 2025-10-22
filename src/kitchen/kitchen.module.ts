import { Module } from '@nestjs/common';

import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { KitchenGateway } from './gateway/kitchen.gateway';

/**
 * Module for Kitchen Display System (KDS) functionality
 */
@Module({
  imports: [AuthModule],
  controllers: [KitchenController],
  providers: [KitchenService, KitchenGateway, PrismaService],
  exports: [KitchenService, KitchenGateway],
})
export class KitchenModule {}
