import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer"; // Use if ClassSerializerInterceptor is global

import { TableStatus } from "src/generated/prisma/client";

export class TableResponseDto {
  @ApiProperty({ format: "uuid" }) @Expose() id: string;
  @ApiProperty({ format: "uuid" }) @Expose() storeId: string;
  @ApiProperty({ example: "Table 10" }) @Expose() name: string;
  @ApiProperty({
    enum: TableStatus,
    enumName: "TableStatus",
    example: TableStatus.VACANT,
    description: "Current status of the table",
  })
  @Expose()
  currentStatus: TableStatus;
  @ApiProperty() @Expose() createdAt: Date;
  @ApiProperty() @Expose() updatedAt: Date;
}
