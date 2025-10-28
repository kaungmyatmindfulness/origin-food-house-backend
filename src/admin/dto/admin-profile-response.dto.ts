import { ApiProperty } from "@nestjs/swagger";

export class AdminProfileResponseDto {
  @ApiProperty({ example: "adm_1234567" })
  id: string;

  @ApiProperty({ example: "admin@originfoodhouse.com" })
  email: string;

  @ApiProperty({ example: "John Doe" })
  name: string;

  @ApiProperty({
    example: "PLATFORM_ADMIN",
    enum: [
      "SUPER_ADMIN",
      "PLATFORM_ADMIN",
      "SUPPORT_AGENT",
      "FINANCE_ADMIN",
      "COMPLIANCE_OFFICER",
    ],
  })
  role: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: "2025-10-28T10:00:00.000Z", nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty({ example: "2025-10-01T10:00:00.000Z" })
  createdAt: Date;
}
