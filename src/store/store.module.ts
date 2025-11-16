import { Module } from "@nestjs/common";

import { AuditLogModule } from "src/audit-log/audit-log.module";
import { AuthModule } from "src/auth/auth.module";
import { S3Service } from "src/common/infra/s3.service";
import { UploadService } from "src/common/upload/upload.service";

import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [StoreController],
  providers: [StoreService, PrismaService, S3Service, UploadService],
  exports: [StoreService],
})
export class StoreModule {}
