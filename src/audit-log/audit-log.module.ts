import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from 'src/auth/auth.module';

import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AuditLogController],
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
