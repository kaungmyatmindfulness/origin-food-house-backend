import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StoreInformationResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  storeId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Base S3 path for logo",
    example: "uploads/abc-123-def",
  })
  logoPath?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: "Base S3 path for cover photo",
    example: "uploads/def-456-ghi",
  })
  coverPhotoPath?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  website?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
