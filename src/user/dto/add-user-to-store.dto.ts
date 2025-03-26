import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AddUserToStoreDto {
  @ApiProperty()
  userId: number;

  @ApiProperty()
  storeId: number;

  @ApiProperty({ enum: Role })
  role: Role;
}
