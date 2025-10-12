import { Module } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';

import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoryController],
  providers: [PrismaService, CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
