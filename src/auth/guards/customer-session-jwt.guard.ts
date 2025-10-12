import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Observable } from 'rxjs';

import { SessionContext } from 'src/auth/customer-session-jwt.strategy';

@Injectable()
export class CustomerSessionJwtAuthGuard extends AuthGuard(
  'customer-session-jwt',
) {
  private readonly logger = new Logger(CustomerSessionJwtAuthGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /**
   * Override handleRequest for custom error handling and logging.
   * Provides explicit types for parameters to satisfy TypeScript.
   * @param err Error object (if verification throws an error)
   * @param user The value returned from the strategy's validate() method, or false
   * @param info Contains error details like TokenExpiredError or JsonWebTokenError from passport-jwt
   * @param context The execution context
   * @param status Optional status
   * @returns The validated user context (SessionContext)
   */
  handleRequest<TUser = SessionContext>(
    err: Error | null,
    user: TUser | false,
    info: Error | { message?: string; name?: string } | undefined,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request?.path || 'unknown path';

    const jwtError = info instanceof Error ? info : err;

    if (jwtError) {
      this.logger.warn(
        `Session JWT Auth Error: ${jwtError.message || jwtError.name || 'Unknown JWT Error'}`,
        `Path: ${path}`,
      );

      if (
        jwtError instanceof TokenExpiredError ||
        info?.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException(
          'Your session has expired. Please join again.',
        );
      }
      if (
        jwtError instanceof JsonWebTokenError ||
        info?.name === 'JsonWebTokenError'
      ) {
        throw new UnauthorizedException('Invalid session token.');
      }

      if (err) {
        throw err;
      }
    }

    if (!user) {
      this.logger.warn(
        `Session JWT Auth Failed. No user context returned. Info: ${JSON.stringify(info)}`,
        `Path: ${path}`,
      );

      throw new UnauthorizedException(
        'Authentication required for this session action.',
      );
    }

    this.logger.verbose(`Session JWT Auth Successful. `, `Path: ${path}`);
    return user;
  }
}
