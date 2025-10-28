import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer"; // Use if ClassSerializerInterceptor is global

export class TableResponseDto {
  @ApiProperty({ format: "uuid" }) @Expose() id: string;
  @ApiProperty({ format: "uuid" }) @Expose() storeId: string;
  @ApiProperty({ example: "Table 10" }) @Expose() name: string;
  @ApiProperty() @Expose() createdAt: Date;
  @ApiProperty() @Expose() updatedAt: Date;
}
