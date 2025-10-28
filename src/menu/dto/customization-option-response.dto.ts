import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class CustomizationOptionResponseDto {
  @ApiProperty({ format: "uuid" })
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  @Type(() => String)
  additionalPrice?: string | null;
}
