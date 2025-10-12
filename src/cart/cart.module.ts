import { Module } from '@nestjs/common';

import { CartController } from 'src/cart/cart.controller';
import { PrismaService } from 'src/prisma/prisma.service';

import { CartGateway } from './cart.gateway';
import { CartService } from './cart.service';
import { ActiveTableSessionModule } from '../active-table-session/active-table-session.module';

@Module({
  imports: [ActiveTableSessionModule],
  controllers: [CartController],
  providers: [
    PrismaService, // PrismaService if needed by CartService
    CartService,
    CartGateway, // Provide the gateway
  ],
  exports: [CartService], // Export service for use in OrderGateway/OrderService etc.
})
export class CartModule {}
