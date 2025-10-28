import { Module } from "@nestjs/common";

import { AdminVerificationController } from "./controllers/admin-verification.controller";
import { OwnershipTransferController } from "./controllers/ownership-transfer.controller";
import { PaymentRequestController } from "./controllers/payment-request.controller";
import { RefundController } from "./controllers/refund.controller";
import { SubscriptionController } from "./controllers/subscription.controller";
import { TrialController } from "./controllers/trial.controller";
import { OwnershipTransferService } from "./services/ownership-transfer.service";
import { PaymentProofService } from "./services/payment-proof.service";
import { RefundService } from "./services/refund.service";
import { SubscriptionService } from "./services/subscription.service";
import { TrialService } from "./services/trial.service";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { AuthModule } from "../auth/auth.module";
import { S3Service } from "../common/infra/s3.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [
    PaymentRequestController,
    AdminVerificationController,
    TrialController,
    OwnershipTransferController,
    RefundController,
    SubscriptionController,
  ],
  providers: [
    SubscriptionService,
    TrialService,
    OwnershipTransferService,
    PaymentProofService,
    RefundService,
    PrismaService,
    S3Service,
  ],
  exports: [
    SubscriptionService,
    TrialService,
    OwnershipTransferService,
    PaymentProofService,
    RefundService,
  ],
})
export class SubscriptionModule {}
