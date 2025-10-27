import { AuditAction } from '@prisma/client';
import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  storeId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  entityType: string; // "Store", "MenuItem", "Payment", etc.

  @IsOptional()
  @IsString()
  entityId?: string; // UUID of affected entity

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>; // Flexible JSON for action-specific data

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}
