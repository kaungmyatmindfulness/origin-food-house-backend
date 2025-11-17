import {
  SupportedLocale,
  TranslationMap,
  BaseTranslationResponseDto,
} from "../dto/translation.dto";

/**
 * Translation record from Prisma (generic structure)
 */
export interface PrismaTranslation {
  locale: string;
  name: string;
  description?: string | null;
}

/**
 * Convert array of Prisma translations to TranslationMap
 */
export function buildTranslationMap<T = BaseTranslationResponseDto>(
  translations: PrismaTranslation[],
): TranslationMap<T> {
  const map: TranslationMap<T> = {};

  for (const translation of translations) {
    const locale = translation.locale as SupportedLocale;

    // Build translation object with proper typing
    const translationObj: BaseTranslationResponseDto = {
      locale,
      name: translation.name,
    };

    // Extend with description if it exists in the source translation
    if ("description" in translation && translation.description !== undefined) {
      (
        translationObj as BaseTranslationResponseDto & {
          description: string | null;
        }
      ).description = translation.description;
    }

    map[locale] = translationObj as T;
  }

  return map;
}

/**
 * Get translated name with fallback logic
 * Priority: requested locale → store primary locale → English → original
 */
export function getTranslatedName(
  defaultName: string,
  translations: PrismaTranslation[],
  requestedLocale?: string,
  storePrimaryLocale: string = "en",
): string {
  if (!requestedLocale) {
    return defaultName;
  }

  // Try requested locale
  const requested = translations.find((t) => t.locale === requestedLocale);
  if (requested) {
    return requested.name;
  }

  // Try store primary locale
  if (requestedLocale !== storePrimaryLocale) {
    const primary = translations.find((t) => t.locale === storePrimaryLocale);
    if (primary) {
      return primary.name;
    }
  }

  // Try English
  if (requestedLocale !== "en" && storePrimaryLocale !== "en") {
    const english = translations.find((t) => t.locale === "en");
    if (english) {
      return english.name;
    }
  }

  // Fall back to default
  return defaultName;
}

/**
 * Get translated description with fallback logic
 * Priority: requested locale → store primary locale → English → original
 */
export function getTranslatedDescription(
  defaultDescription: string | null,
  translations: PrismaTranslation[],
  requestedLocale?: string,
  storePrimaryLocale: string = "en",
): string | null {
  if (!requestedLocale) {
    return defaultDescription;
  }

  // Try requested locale
  const requested = translations.find((t) => t.locale === requestedLocale);
  if (requested?.description !== undefined) {
    return requested.description;
  }

  // Try store primary locale
  if (requestedLocale !== storePrimaryLocale) {
    const primary = translations.find((t) => t.locale === storePrimaryLocale);
    if (primary?.description !== undefined) {
      return primary.description;
    }
  }

  // Try English
  if (requestedLocale !== "en" && storePrimaryLocale !== "en") {
    const english = translations.find((t) => t.locale === "en");
    if (english?.description !== undefined) {
      return english.description;
    }
  }

  // Fall back to default
  return defaultDescription;
}

/**
 * Prisma include clause for fetching translations
 */
export const translationsInclude = {
  translations: {
    select: {
      locale: true,
      name: true,
      description: true,
    },
  },
};
