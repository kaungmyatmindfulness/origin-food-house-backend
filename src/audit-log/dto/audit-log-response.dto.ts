import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { AuditAction } from "src/generated/prisma/client";

import { AuditLogDetailsDto } from "./audit-log-details.dto";

/**
 * DTO for audit log user information
 */
export class AuditLogUserDto {
  @ApiProperty({ description: "User ID", example: "0194ca3b-..." })
  id: string;

  @ApiPropertyOptional({
    description: "User email",
    example: "user@example.com",
  })
  email?: string;

  @ApiPropertyOptional({ description: "User name", example: "John Doe" })
  name?: string;
}

/**
 * DTO for individual audit log entry
 */
export class AuditLogEntryDto {
  @ApiProperty({ description: "Audit log ID", example: "0194ca3b-..." })
  id: string;

  @ApiProperty({ description: "Store ID", example: "0194ca3b-..." })
  storeId: string;

  @ApiPropertyOptional({
    description: "User who performed the action",
    type: AuditLogUserDto,
  })
  user?: AuditLogUserDto;

  @ApiProperty({
    enum: [
      "STORE_CREATED",
      "STORE_UPDATED",
      "STORE_DELETED",
      "USER_ADDED",
      "USER_REMOVED",
      "USER_ROLE_CHANGED",
      "MENU_ITEM_CREATED",
      "MENU_ITEM_UPDATED",
      "MENU_ITEM_DELETED",
      "ORDER_CREATED",
      "ORDER_UPDATED",
      "ORDER_CANCELLED",
      "PAYMENT_CREATED",
      "PAYMENT_REFUNDED",
      "SETTINGS_UPDATED",
    ],
    description: "Action performed",
    example: "MENU_ITEM_CREATED",
  })
  action: AuditAction;

  @ApiProperty({
    description: "Type of entity affected",
    example: "MenuItem",
  })
  entityType: string;

  @ApiPropertyOptional({
    description: "ID of the affected entity",
    example: "0194ca3b-...",
  })
  entityId?: string;

  @ApiPropertyOptional({
    type: () => AuditLogDetailsDto,
    description:
      "Additional action-specific details (fields vary by action type)",
    example: { previousValue: "10.00", newValue: "12.00", fieldName: "price" },
    nullable: true,
  })
  details?: AuditLogDetailsDto;

  @ApiPropertyOptional({
    description: "IP address of the requester",
    example: "192.168.1.1",
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: "User agent of the requester",
    example: "Mozilla/5.0...",
  })
  userAgent?: string;

  @ApiProperty({ description: "Timestamp of the action" })
  createdAt: Date;
}

/**
 * DTO for paginated audit log response
 * Matches the service return type: { logs, total, page, limit }
 */
export class AuditLogPaginatedResponseDto {
  @ApiProperty({
    description: "Array of audit log entries",
    type: [AuditLogEntryDto],
  })
  logs: AuditLogEntryDto[];

  @ApiProperty({ description: "Total count of matching logs", example: 100 })
  total: number;

  @ApiProperty({ description: "Current page number", example: 1 })
  page: number;

  @ApiProperty({ description: "Items per page", example: 50 })
  limit: number;
}
