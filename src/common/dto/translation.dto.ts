import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsIn } from "class-validator";

/**
 * Supported locales in the application
 */
export const SUPPORTED_LOCALES = ["en", "zh", "my", "th"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Base translation DTO for entities with name only
 */
export class BaseTranslationDto {
  @ApiProperty({
    description: "Locale code",
    example: "en",
    enum: SUPPORTED_LOCALES,
  })
  @IsString()
  @IsIn(SUPPORTED_LOCALES, {
    message: `Locale must be one of: ${SUPPORTED_LOCALES.join(", ")}`,
  })
  locale: SupportedLocale;

  @ApiProperty({
    description: "Translated name",
    example: "Appetizers",
  })
  @IsString()
  name: string;
}

/**
 * Translation DTO for entities with name and description
 */
export class TranslationWithDescriptionDto extends BaseTranslationDto {
  @ApiPropertyOptional({
    description: "Translated description",
    example: "Delicious appetizers to start your meal",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;
}

/**
 * Response DTO for translations (name only)
 */
export class BaseTranslationResponseDto {
  @ApiProperty({
    description: "Locale code",
    example: "en",
    enum: SUPPORTED_LOCALES,
  })
  locale: SupportedLocale;

  @ApiProperty({
    description: "Translated name",
    example: "Appetizers",
  })
  name: string;
}

/**
 * Response DTO for translations (name and description)
 */
export class TranslationWithDescriptionResponseDto extends BaseTranslationResponseDto {
  @ApiPropertyOptional({
    description: "Translated description",
    example: "Delicious appetizers to start your meal",
    nullable: true,
  })
  description: string | null;
}

/**
 * Helper type for translation map in responses
 */
export type TranslationMap<T = BaseTranslationResponseDto> = Partial<
  Record<SupportedLocale, T>
>;
