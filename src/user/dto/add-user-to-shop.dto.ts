import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AddUserToShopDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  shopId: number;

  @ApiProperty({ enum: Role })
  role: Role;
}
