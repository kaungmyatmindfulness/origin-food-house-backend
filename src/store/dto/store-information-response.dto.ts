import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StoreInformationResponseDto {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  storeId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({
    nullable: true,
    description: "Base S3 path for logo",
    example: "uploads/abc-123-def",
  })
  logoPath?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: "Base S3 path for cover photo",
    example: "uploads/def-456-ghi",
  })
  coverPhotoPath?: string | null;

  @ApiPropertyOptional({ nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  website?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
