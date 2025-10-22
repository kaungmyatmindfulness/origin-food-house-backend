import { Module } from '@nestjs/common';

import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Module for analytics and reporting functionality
 */
@Module({
  imports: [AuthModule],
  controllers: [ReportController],
  providers: [ReportService, PrismaService],
  exports: [ReportService],
})
export class ReportModule {}
