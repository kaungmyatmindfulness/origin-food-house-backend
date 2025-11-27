import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { Currency } from "src/generated/prisma/client";

export class StoreSettingResponseDto {
  @ApiProperty({ format: "uuid", description: "Setting record ID" })
  id: string;

  @ApiProperty({ format: "uuid", description: "ID of the associated store" })
  storeId: string;

  @ApiProperty({
    enum: Currency,
    example: Currency.USD,
    description: "Store currency code",
  })
  currency: Currency;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "0.07",
    description: "VAT rate (e.g., 0.07 for 7%)",
  })
  vatRate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "0.10",
    description: "Service charge rate (e.g., 0.10 for 10%)",
  })
  serviceChargeRate?: string | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      "Business hours configuration as JSON (keys: days of week, values: open/close times)",
    example: {
      monday: { open: "09:00", close: "22:00", isOpen: true },
      tuesday: { open: "09:00", close: "22:00", isOpen: true },
    },
  })
  businessHours?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    description:
      "Special hours configuration as JSON (holidays, special events)",
    example: {
      "2025-12-25": { open: "10:00", close: "18:00", note: "Christmas Day" },
    },
  })
  specialHours?: Record<string, unknown> | null;

  @ApiProperty({
    type: Boolean,
    default: false,
    description: "Whether to accept orders when the store is closed",
  })
  acceptOrdersWhenClosed: boolean;

  @ApiProperty({
    type: Boolean,
    default: false,
    description: "Whether loyalty program is enabled for this store",
  })
  loyaltyEnabled: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Points earned per currency unit spent (e.g., 0.1 = 1 point per 10 units)",
    example: "0.1",
  })
  loyaltyPointRate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Currency value per point redeemed (e.g., 0.1 = 10 currency per 100 points)",
    example: "0.1",
  })
  loyaltyRedemptionRate?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    default: 365,
    description: "Number of days before loyalty points expire",
    example: 365,
  })
  loyaltyPointExpiryDays?: number | null;

  @ApiProperty({
    type: String,
    default: "en",
    description: "Primary locale for the store",
    example: "en",
  })
  primaryLocale: string;

  @ApiProperty({
    type: [String],
    default: ["en"],
    description: "List of enabled locales for multi-language support",
    example: ["en", "th", "my"],
  })
  enabledLocales: string[];

  @ApiProperty({
    type: Boolean,
    default: false,
    description: "Whether multi-language support is enabled",
  })
  multiLanguageEnabled: boolean;

  @ApiPropertyOptional({
    type: Date,
    nullable: true,
    description: "Timestamp when multi-language was migrated/enabled",
  })
  multiLanguageMigratedAt?: Date | null;

  @ApiProperty({ description: "Record creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Record last update timestamp" })
  updatedAt: Date;
}
