import { AuthModule } from 'src/auth/auth.module';

import { Module } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [AuthModule],
  controllers: [CategoryController],
  providers: [PrismaService, CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
