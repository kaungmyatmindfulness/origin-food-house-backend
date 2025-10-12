import { Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { TableController } from './table.controller';
import { TableService } from './table.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TableController],
  providers: [TableService, PrismaService],
  exports: [TableService],
})
export class TableModule {}
