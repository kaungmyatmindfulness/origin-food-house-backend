import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TableSessionService } from './table-session.service';
import { TableSessionController } from './table-session.controller';

@Module({
  providers: [PrismaService, TableSessionService],
  controllers: [TableSessionController],
  exports: [TableSessionService],
})
export class TableSessionModule {}
