import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartGateway } from './cart.gateway';
import { ActiveTableSessionModule } from '../active-table-session/active-table-session.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { CartController } from 'src/cart/cart.controller';

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
