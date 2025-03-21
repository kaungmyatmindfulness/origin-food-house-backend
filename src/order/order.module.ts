import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  providers: [PrismaService, OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
