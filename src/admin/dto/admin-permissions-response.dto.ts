import { ApiProperty } from "@nestjs/swagger";

export class AdminPermissionsResponseDto {
  @ApiProperty({ example: "PLATFORM_ADMIN" })
  role: string;

  @ApiProperty({ example: ["store:manage", "user:manage", "payment:manage"] })
  permissions: string[];
}
