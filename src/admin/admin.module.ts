import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "src/auth/auth.module";
import { PrismaService } from "src/prisma/prisma.service";
import { SubscriptionModule } from "src/subscription/subscription.module";

import adminAuth0Config from "./config/admin-auth0.config";
import { AdminAuthController } from "./controllers/admin-auth.controller";
import { AdminPaymentController } from "./controllers/admin-payment.controller";
import { AdminStoreController } from "./controllers/admin-store.controller";
import { AdminUserController } from "./controllers/admin-user.controller";
import { AdminAuditService } from "./services/admin-audit.service";
import { AdminAuthService } from "./services/admin-auth.service";
import { AdminAuth0Service } from "./services/admin-auth0.service";
import { AdminStoreService } from "./services/admin-store.service";
import { AdminUserService } from "./services/admin-user.service";
import { SuspensionService } from "./services/suspension.service";

@Module({
  imports: [
    ConfigModule.forFeature(adminAuth0Config),
    AuthModule,
    SubscriptionModule,
  ],
  controllers: [
    AdminAuthController,
    AdminStoreController,
    AdminUserController,
    AdminPaymentController,
  ],
  providers: [
    PrismaService,
    AdminAuth0Service,
    AdminAuthService,
    AdminStoreService,
    AdminUserService,
    AdminAuditService,
    SuspensionService,
  ],
  exports: [AdminAuthService, AdminAuditService],
})
export class AdminModule {}
