import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEnum } from "class-validator";

export class ChangeRoleDto {
  @ApiProperty({
    description: "New role to assign to the user",
    enum: Role,
    example: Role.ADMIN,
  })
  @IsEnum(Role)
  role: Role;
}
