import { Transform } from "class-transformer";
import { IsString, IsEnum, IsOptional, IsObject } from "class-validator";

import { AuditAction } from "src/generated/prisma/client";

export class CreateAuditLogDto {
  @IsString()
  storeId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  entityType: string; // "Store", "MenuItem", "Payment", etc.

  @IsOptional()
  @IsString()
  entityId?: string; // UUID of affected entity

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>; // Flexible JSON for action-specific data

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  ipAddress?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  userAgent?: string;
}
