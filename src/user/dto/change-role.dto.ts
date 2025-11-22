import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

import { Role } from "src/generated/prisma/client";

export class ChangeRoleDto {
  @ApiProperty({
    description: "New role to assign to the user",
    enum: Role,
    example: Role.ADMIN,
  })
  @IsEnum(Role)
  role: Role;
}
