import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';

import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [StoreController],
  providers: [StoreService, PrismaService],
  exports: [StoreService],
})
export class StoreModule {}
