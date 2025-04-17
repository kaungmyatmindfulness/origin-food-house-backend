import { PrismaService } from 'src/prisma/prisma.service';

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TableController } from './table.controller';
import { TableService } from './table.service';

@Module({
  imports: [AuthModule],
  controllers: [TableController],
  providers: [TableService, PrismaService],
  exports: [TableService],
})
export class TableModule {}
