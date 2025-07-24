import { HttpException, InternalServerErrorException } from '@nestjs/common';

/**
 * StandardErrorHandler decorator for consistent error handling across services.
 *
 * This decorator provides:
 * - Consistent error logging with stack traces
 * - Re-throwing of HttpExceptions (preserves specific error types like BadRequestException, NotFoundException)
 * - Converting unknown errors to InternalServerErrorException with context
 *
 * @param context - Descriptive context for the operation (e.g., "create category", "update menu item")
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class CategoryService {
 *   private readonly logger = new Logger(CategoryService.name);
 *
 *   @StandardErrorHandler('create category')
 *   async create(userId: string, storeId: string, dto: CreateCategoryDto): Promise<Category> {
 *     // Implementation that may throw errors
 *     return await this.prisma.category.create({...});
 *   }
 * }
 * ```
 */
export function StandardErrorHandler(context: string) {
  return function (
    target: unknown,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const method = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (this: any, ...args: unknown[]) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return await method.apply(this, args);
      } catch (error) {
        // Re-throw HttpExceptions as-is to preserve specific error types
        if (error instanceof HttpException) {
          throw error;
        }

        // Log the error with context and stack trace
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (this.logger && typeof this.logger.error === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          this.logger.error(
            `[${context}] ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error.stack : undefined,
          );
        }

        // Convert unknown errors to InternalServerErrorException
        throw new InternalServerErrorException(`Failed to ${context}`);
      }
    };

    return descriptor;
  };
}
