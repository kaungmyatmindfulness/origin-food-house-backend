import { AuthModule } from 'src/auth/auth.module';

import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
