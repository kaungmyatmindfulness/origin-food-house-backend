import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

export class UserProfileResponseDto {
  @ApiProperty({ description: "User's unique identifier", example: 123 })
  id: string;

  @ApiProperty({
    description: "User's email address",
    example: "user@example.com",
  })
  email: string;

  @ApiPropertyOptional({
    description: "User's display name",
    example: "Jane Doe",
    nullable: true,
  })
  name?: string | null;

  @ApiProperty({
    description: "Indicates if the user email is verified",
    example: true,
  })
  verified: boolean;

  @ApiPropertyOptional({
    description:
      "User's role in the specific store requested via query parameter (if provided and user is a member)",
    enum: Role,
    example: Role.CASHIER,
    nullable: true,
  })
  selectedStoreRole?: Role | null;

  @ApiProperty({ description: "Timestamp when the user was created" })
  createdAt: Date;
}
