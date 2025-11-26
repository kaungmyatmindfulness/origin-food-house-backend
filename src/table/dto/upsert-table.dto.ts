import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
} from "class-validator";

export class UpsertTableDto {
  @ApiPropertyOptional({
    description:
      "ID (UUID) of the table to update. Omit to create a new table.",
    format: "uuid",
    example: "018ec1a8-0f9b-7d9c-a4f2-0d3f1a0f9b8c",
  })
  @IsOptional()
  @IsUUID(7, { message: "Provided ID must be a valid UUID" })
  id?: string;

  @ApiProperty({
    description:
      "Display name or number for the table (must be unique within the store)",
    example: "Table 12 / Patio Seat 4",
    maxLength: 50,
  })
  @IsNotEmpty({ message: "Table name cannot be empty." })
  @IsString()
  @MaxLength(50)
  name: string;
}
