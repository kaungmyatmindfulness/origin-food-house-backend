import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';

@Module({
  imports: [],
  providers: [PrismaService, MenuService],
  controllers: [MenuController],
  exports: [MenuService],
})
export class MenuModule {}
