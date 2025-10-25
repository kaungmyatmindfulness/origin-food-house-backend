import { Module } from '@nestjs/common';

import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AuthModule } from '../auth/auth.module';
import { KitchenModule } from '../kitchen/kitchen.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule, KitchenModule],
  controllers: [OrderController],
  providers: [OrderService, PrismaService],
  exports: [OrderService],
})
export class OrderModule {}
