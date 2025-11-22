import { ApiProperty } from "@nestjs/swagger";

import { SessionStatus } from "src/generated/prisma/client";

/**
 * Response DTO for session queries
 * SECURITY: Session token is EXCLUDED for security (only provided on creation)
 */
export class SessionResponseDto {
  @ApiProperty({ description: "Session ID" })
  id: string;

  @ApiProperty({ description: "Store ID" })
  storeId: string;

  @ApiProperty({ description: "Table ID", nullable: true })
  tableId: string | null;

  @ApiProperty({ description: "Session status", enum: SessionStatus })
  status: SessionStatus;

  @ApiProperty({ description: "Number of guests" })
  guestCount: number;

  @ApiProperty({ description: "Closed timestamp", nullable: true })
  closedAt: Date | null;

  @ApiProperty({ description: "Created timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated timestamp" })
  updatedAt: Date;
}
