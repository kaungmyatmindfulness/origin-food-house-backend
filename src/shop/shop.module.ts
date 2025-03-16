import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [ShopController],
  providers: [ShopService, PrismaService],
  exports: [ShopService],
})
export class ShopModule {}
