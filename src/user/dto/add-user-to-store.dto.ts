import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class AddUserToStoreDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  storeId: string;

  @ApiProperty({ enum: Role })
  role: Role;
}
