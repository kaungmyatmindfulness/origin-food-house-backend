import { Prisma } from "src/generated/prisma/client";

/**
 * Pure data conversion utility functions for store service
 * These functions have no side effects and can be used across the application
 */

/**
 * Converts empty strings to null for optional database fields.
 * Ensures that empty strings are stored as NULL in the database.
 * @param value Optional string value from user input
 * @returns Trimmed string or null if empty/undefined
 */
export function emptyToNull(value: string | undefined): string | null {
  return value?.trim().length ? value.trim() : null;
}

/**
 * Converts any object to Prisma.InputJsonValue.
 * This is a type-safe wrapper for JSON field assignments.
 * @param value Any JSON-serializable value
 * @returns Prisma-compatible JSON value
 */
export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  // Prisma.InputJsonValue accepts null, string, number, boolean, JsonObject, or JsonArray
  // This type assertion is safe as long as the value conforms to JSON-serializable data
  return value as Prisma.InputJsonValue;
}

/**
 * Converts a price string to Prisma Decimal for monetary values.
 * Returns null if the input is null or invalid.
 * @param priceString Price as string (e.g., "12.99") or null
 * @returns Prisma Decimal or null
 */
export function toPrismaDecimal(
  priceString: string | null,
): Prisma.Decimal | null {
  if (priceString === null) return null;
  return new Prisma.Decimal(priceString);
}
