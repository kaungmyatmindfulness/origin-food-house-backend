import { Module } from "@nestjs/common";

import { AuditLogModule } from "src/audit-log/audit-log.module";
import { AuthModule } from "src/auth/auth.module";
import { CategoryModule } from "src/category/category.module";
import { S3Service } from "src/common/infra/s3.service";
import { UploadService } from "src/common/upload/upload.service";
import { MenuModule } from "src/menu/menu.module";
import { TableModule } from "src/table/table.module";

import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  imports: [
    AuthModule,
    AuditLogModule,
    CategoryModule,
    TableModule,
    MenuModule,
  ],
  controllers: [StoreController],
  providers: [StoreService, PrismaService, S3Service, UploadService],
  exports: [StoreService],
})
export class StoreModule {}
