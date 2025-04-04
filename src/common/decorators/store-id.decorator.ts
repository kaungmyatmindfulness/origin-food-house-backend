import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithUser } from 'src/auth/types'; // Adjust path if needed

/**
 * Custom parameter decorator to extract the 'storeId' from the JWT payload
 * attached to the request object by JwtAuthGuard.
 * Throws BadRequestException if storeId is missing.
 */
export const StoreId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      // This should technically be caught by JwtAuthGuard, but safeguard anyway
      console.error(
        'StoreId decorator error: req.user is undefined. Is JwtAuthGuard running?',
      );
      throw new InternalServerErrorException(
        'Authentication context not found.',
      );
    }

    const storeId = user.storeId;

    if (storeId === undefined || storeId === null) {
      // Check for undefined or null specifically
      throw new BadRequestException(
        'Store context is required for this action. Please select a store.',
      );
    }

    // Optionally check if it's actually a number, though JWT payload structure should ensure this
    if (typeof storeId !== 'number') {
      console.error(
        `StoreId decorator error: storeId found in JWT payload is not a number. Payload: ${JSON.stringify(user)}`,
      );
      throw new InternalServerErrorException(
        'Invalid store context found in token.',
      );
    }

    return storeId;
  },
);
