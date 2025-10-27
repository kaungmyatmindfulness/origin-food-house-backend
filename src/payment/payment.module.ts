import { Module } from '@nestjs/common';

import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
  exports: [PaymentService],
})
export class PaymentModule {}
