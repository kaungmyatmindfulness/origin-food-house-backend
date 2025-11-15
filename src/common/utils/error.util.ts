/**
 * Error handling utility functions
 * Provides type-safe error message and stack extraction
 */

export interface ErrorDetails {
  message: string;
  stack?: string;
}

/**
 * Safely extracts error message and stack from unknown error types
 * @param error - The error object (unknown type from catch blocks)
 * @returns Object with message and optional stack trace
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const { message, stack } = getErrorDetails(error);
 *   this.logger.error(`Operation failed: ${message}`, stack);
 * }
 * ```
 */
export function getErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  // Handle non-Error objects
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    const message =
      typeof obj.message === "string"
        ? obj.message
        : obj.message !== undefined
          ? JSON.stringify(obj.message)
          : JSON.stringify(error);
    const stack =
      typeof obj.stack === "string"
        ? obj.stack
        : obj.stack !== undefined
          ? JSON.stringify(obj.stack)
          : undefined;
    return { message, stack };
  }

  // Handle primitives
  return {
    message: String(error),
    stack: undefined,
  };
}
