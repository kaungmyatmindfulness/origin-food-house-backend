import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";

import { TableStatus } from "src/generated/prisma/client";

export class UpdateTableStatusDto {
  @ApiProperty({
    description: "New status for the table",
    enum: TableStatus,
    example: TableStatus.SEATED,
  })
  @IsNotEmpty()
  @IsEnum(TableStatus)
  status: TableStatus;
}
