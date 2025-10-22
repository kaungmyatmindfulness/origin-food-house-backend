import { Module } from '@nestjs/common';

import { CartController } from './cart.controller';
import { CartGateway } from './cart.gateway';
import { CartService } from './cart.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [CartService, CartGateway, PrismaService],
  exports: [CartService],
})
export class CartModule {}
