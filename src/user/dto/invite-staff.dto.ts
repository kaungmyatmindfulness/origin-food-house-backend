import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { IsEmail, IsEnum } from "class-validator";

export class InviteStaffDto {
  @ApiProperty({
    description: "Email address of the staff member to invite",
    example: "newstaff@example.com",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: "Role to assign to the staff member",
    enum: Role,
    example: Role.SERVER,
  })
  @IsEnum(Role)
  role: Role;
}
