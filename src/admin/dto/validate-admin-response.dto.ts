import { ApiProperty } from "@nestjs/swagger";

import { AdminRole } from "src/generated/prisma/client";

export class AdminUserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AdminRole })
  role: AdminRole;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  lastLoginAt: Date | null;
}

export class ValidateAdminResponseDto {
  @ApiProperty()
  adminUser: AdminUserResponseDto;

  @ApiProperty({ description: "Internal JWT for authenticated API requests" })
  jwt: string;

  @ApiProperty({
    description: "List of permissions based on admin role",
    example: ["stores:read", "users:read", "payments:verify"],
    type: [String],
  })
  permissions: string[];
}
