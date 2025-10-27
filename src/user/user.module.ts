import { Module, forwardRef } from '@nestjs/common';

import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { PrismaService } from '../prisma/prisma.service';
import { TierModule } from '../tier/tier.module';

@Module({
  imports: [
    EmailModule,
    TierModule,
    AuditLogModule,
    forwardRef(() => AuthModule),
  ],
  providers: [UserService, PrismaService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
