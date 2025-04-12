import { AuthModule } from 'src/auth/auth.module';

import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  imports: [AuthModule],
  controllers: [StoreController],
  providers: [StoreService, PrismaService],
  exports: [StoreService],
})
export class StoreModule {}
