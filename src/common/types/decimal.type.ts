/**
 * Decimal type re-export for Prisma 7 compatibility
 *
 * In Prisma 7, Decimal is accessed via Prisma.Decimal from @prisma/client
 * instead of the deprecated @prisma/client/runtime/library path.
 *
 * This helper provides a convenient import for Decimal across the codebase.
 */
import { Prisma } from "src/generated/prisma/client";

export const { Decimal } = Prisma;
export type Decimal = Prisma.Decimal;
