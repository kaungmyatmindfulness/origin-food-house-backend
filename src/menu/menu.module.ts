import { Module } from "@nestjs/common";

import { AuditLogModule } from "src/audit-log/audit-log.module";
import { AuthModule } from "src/auth/auth.module";
import { TierModule } from "src/tier/tier.module";

import { MenuController, CustomizationController } from "./menu.controller";
import { MenuService } from "./menu.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  imports: [AuthModule, AuditLogModule, TierModule],
  providers: [PrismaService, MenuService],
  controllers: [MenuController, CustomizationController],
  exports: [MenuService],
})
export class MenuModule {}
