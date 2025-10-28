import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
} from "class-validator";

export class UpdateStoreInformationDto {
  @ApiProperty({
    description: "Store's display name",
    example: "My New Cafe",
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: "Store's logo URL",
    example: "https://example.com/logo.png",
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  logoUrl?: string;

  @ApiPropertyOptional({
    description: "Store's physical address",
    example: "456 Side St, Anytown",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;
  @ApiPropertyOptional({
    description: "Store's contact phone number",
    example: "555-987-6543",
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, {
    message: "Invalid phone number format",
  })
  @MaxLength(20)
  phone?: string;
  @ApiPropertyOptional({
    description: "Store's contact email address",
    example: "info@mynewcafe.com",
    maxLength: 100,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
  @ApiPropertyOptional({
    description: "Store's website URL",
    example: "https://mynewcafe.com",
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(255)
  website?: string;
}
