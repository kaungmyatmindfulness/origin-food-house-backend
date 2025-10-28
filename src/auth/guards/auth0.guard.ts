import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class Auth0Guard extends AuthGuard("auth0") {
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | false,
    _info: unknown,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException("Invalid Auth0 token");
    }
    return user as TUser;
  }
}
