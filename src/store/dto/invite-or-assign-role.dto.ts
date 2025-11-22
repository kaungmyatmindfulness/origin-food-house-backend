import { ApiProperty } from "@nestjs/swagger";

import { Role } from "src/generated/prisma/client";

export class InviteOrAssignRoleDto {
  @ApiProperty({
    description: "The email of the user to invite or assign a role to",
    example: "newuser@example.com",
  })
  email: string;

  @ApiProperty({
    description: "The new role for the user in this store",
    enum: Role,
    example: "ADMIN",
  })
  role: Role;
}
