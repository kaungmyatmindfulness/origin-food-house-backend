import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';

import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  providers: [PrismaService, MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
