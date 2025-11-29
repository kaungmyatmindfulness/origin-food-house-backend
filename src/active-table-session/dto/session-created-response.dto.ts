import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SessionStatus, SessionType } from "src/generated/prisma/client";

/**
 * Response DTO for session creation
 * SECURITY: Session token is ONLY returned on session creation, never on subsequent queries
 */
export class SessionCreatedResponseDto {
  @ApiProperty({ description: "Session ID" })
  id: string;

  @ApiProperty({ description: "Store ID" })
  storeId: string;

  @ApiProperty({ type: String, description: "Table ID", nullable: true })
  tableId: string | null;

  @ApiProperty({
    description: "Session type",
    enum: SessionType,
    default: SessionType.TABLE,
  })
  sessionType: SessionType;

  @ApiProperty({ description: "Session status", enum: SessionStatus })
  status: SessionStatus;

  @ApiPropertyOptional({
    type: String,
    description: "Customer name",
    nullable: true,
  })
  customerName: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Customer phone number",
    nullable: true,
  })
  customerPhone: string | null;

  @ApiProperty({ description: "Number of guests" })
  guestCount: number;

  @ApiProperty({
    description:
      "Session token for authentication - ONLY provided on session creation",
  })
  sessionToken: string;

  @ApiProperty({ type: Date, description: "Closed timestamp", nullable: true })
  closedAt: Date | null;

  @ApiProperty({ description: "Created timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Updated timestamp" })
  updatedAt: Date;
}
