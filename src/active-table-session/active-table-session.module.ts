import { Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import { ActiveTableSessionController } from './active-table-session.controller';
import { ActiveTableSessionService } from './active-table-session.service';

@Module({
  imports: [],
  controllers: [ActiveTableSessionController],
  providers: [ActiveTableSessionService, PrismaService],
  exports: [ActiveTableSessionService],
})
export class ActiveTableSessionModule {}
