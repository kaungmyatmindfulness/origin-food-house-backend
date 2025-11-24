/**
 * Sort order calculation utility functions
 * Provides type-safe sortOrder calculation for entities with sequential ordering
 */

/**
 * Calculates the next available sortOrder value for an entity collection.
 *
 * This function queries the maximum existing sortOrder value within the specified
 * scope (defined by the where clause) and returns the next sequential value.
 * If no items exist, returns 0 as the starting sortOrder.
 *
 * **Common Use Cases:**
 * - Categories within a store: `calculateNextSortOrder(tx, 'category', { storeId, deletedAt: null })`
 * - Menu items within a category: `calculateNextSortOrder(tx, 'menuItem', { storeId, categoryId, deletedAt: null })`
 * - Tables within a store: `calculateNextSortOrder(tx, 'table', { storeId, deletedAt: null })`
 *
 * **Soft Delete Support:**
 * Always include `deletedAt: null` in the where clause to exclude soft-deleted items
 * from sortOrder calculations.
 *
 * @param tx - Prisma transaction client (use within $transaction callback)
 * @param model - Prisma model name (e.g., 'category', 'menuItem', 'table')
 * @param whereClause - Filter conditions to scope the sortOrder calculation
 * @returns Promise resolving to the next sequential sortOrder value (0-based indexing)
 *
 * @example
 * ```typescript
 * // In CategoryService
 * const nextSortOrder = await calculateNextSortOrder(
 *   tx,
 *   'category',
 *   { storeId: 'store-123', deletedAt: null }
 * );
 * // Returns 0 if no categories exist, or max(sortOrder) + 1
 *
 * // In MenuService
 * const nextSortOrder = await calculateNextSortOrder(
 *   tx,
 *   'menuItem',
 *   { storeId: 'store-123', categoryId: 'cat-456', deletedAt: null }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Full usage in a service method
 * async createCategory(storeId: string, dto: CreateCategoryDto) {
 *   return await this.prisma.$transaction(async (tx) => {
 *     const sortOrder = await calculateNextSortOrder(
 *       tx,
 *       'category',
 *       { storeId, deletedAt: null }
 *     );
 *
 *     return await tx.category.create({
 *       data: { ...dto, storeId, sortOrder },
 *     });
 *   });
 * }
 * ```
 */
export async function calculateNextSortOrder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any, // Transaction client - using 'any' for dynamic model access
  model: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whereClause: Record<string, any>,
): Promise<number> {
  // Type assertion to access model dynamically
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const modelDelegate = tx[model];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (!modelDelegate || typeof modelDelegate.aggregate !== "function") {
    throw new Error(
      `Invalid model name: "${model}". Model must exist in Prisma schema with aggregate support.`,
    );
  }

  // Perform aggregate query to find maximum sortOrder
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const result = await modelDelegate.aggregate({
    _max: { sortOrder: true },
    where: whereClause,
  });

  // Return next sequential value (0 if no items exist)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return (result._max.sortOrder ?? -1) + 1;
}
