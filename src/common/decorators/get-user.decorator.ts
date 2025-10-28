import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Decorator to extract user data from JWT in request object
 * Used for authenticated staff endpoints (RMS app)
 * @param data - Optional property path to extract specific field from user object (e.g., 'sub' for user ID)
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: Record<string, unknown> }>();
    const { user } = request;

    // If a specific property is requested, return that property
    if (data && user) {
      return user[data];
    }

    // Otherwise return the full user object
    return user;
  },
);
