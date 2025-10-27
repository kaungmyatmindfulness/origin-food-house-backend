import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaService } from 'src/prisma/prisma.service';

import { TableController } from './table.controller';
import { TableGateway } from './table.gateway';
import { TableService } from './table.service';
import { AuthModule } from '../auth/auth.module';
import { TierModule } from '../tier/tier.module';

@Module({
  imports: [AuthModule, ConfigModule, TierModule],
  controllers: [TableController],
  providers: [TableService, TableGateway, PrismaService],
  exports: [TableService, TableGateway],
})
export class TableModule {}
