import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
  ValidateIf,
} from "class-validator";

import { IsImagePath } from "src/common/validators/is-image-path.validator";

export class UpdateStoreInformationDto {
  @ApiProperty({
    description: "Store's display name",
    example: "My New Cafe",
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description:
      "Store's logo base path (S3). Frontend constructs URL: baseUrl + logoPath + '-' + size + '.webp'",
    example: "uploads/abc-123-def-456",
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateStoreInformationDto) => o.logoPath !== "" && o.logoPath !== null,
  )
  @IsString()
  @IsImagePath()
  @MaxLength(255)
  logoPath?: string | null;

  @ApiPropertyOptional({
    description:
      "Store's cover photo base path (S3). Frontend constructs URL: baseUrl + coverPhotoPath + '-' + size + '.webp'",
    example: "uploads/def-456-ghi-789",
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateStoreInformationDto) =>
      o.coverPhotoPath !== "" && o.coverPhotoPath !== null,
  )
  @IsString()
  @IsImagePath()
  @MaxLength(255)
  coverPhotoPath?: string | null;

  @ApiPropertyOptional({
    description: "Store's physical address",
    example: "456 Side St, Anytown",
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateStoreInformationDto) => o.address !== "" && o.address !== null,
  )
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  address?: string | null;

  @ApiPropertyOptional({
    description: "Store's contact phone number",
    example: "555-987-6543",
    maxLength: 20,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateStoreInformationDto) => o.phone !== "" && o.phone !== null,
  )
  @IsString()
  @Matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, {
    message: "Invalid phone number format",
  })
  @MaxLength(20)
  phone?: string | null;

  @ApiPropertyOptional({
    description: "Store's contact email address",
    example: "info@mynewcafe.com",
    maxLength: 100,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateStoreInformationDto) => o.email !== "" && o.email !== null,
  )
  @IsEmail()
  @MaxLength(100)
  email?: string | null;

  @ApiPropertyOptional({
    description: "Store's website URL",
    example: "https://mynewcafe.com",
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateStoreInformationDto) => o.website !== "" && o.website !== null,
  )
  @IsUrl()
  @MaxLength(255)
  website?: string | null;
}
