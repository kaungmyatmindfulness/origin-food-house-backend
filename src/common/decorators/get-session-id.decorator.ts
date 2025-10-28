import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Decorator to extract sessionId from request headers or query params
 * Used for customer-facing endpoints (SOS app)
 */
export const GetSessionId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, unknown>;
      query?: Record<string, unknown>;
    }>();

    // Try to get from header first (for WebSocket or API calls with auth)
    const headerSessionId = request.headers["x-session-id"];
    if (typeof headerSessionId === "string") {
      return headerSessionId;
    }

    // Fallback to query parameter
    const querySessionId = request.query?.sessionId;
    if (typeof querySessionId === "string") {
      return querySessionId;
    }

    // If neither exists, return undefined (will be handled by validation)
    return undefined;
  },
);
