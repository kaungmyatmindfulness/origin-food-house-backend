import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";

import { JwtPayload } from "../interfaces/jwt-payload.interface";

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      sub: string;
      storeId?: string;
    };
  };
  handshake: Socket["handshake"] & {
    auth?: {
      token?: string;
    };
  };
}

/**
 * WebSocket JWT Authentication Guard
 * Validates JWT tokens from WebSocket connections
 *
 * Token can be provided in:
 * 1. Authorization header (Bearer token)
 * 2. Query parameter (?token=xxx)
 * 3. Handshake auth object (auth.token)
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates the WebSocket connection by checking JWT token
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const method = "canActivate";

    try {
      const client: AuthenticatedSocket = context.switchToWs().getClient();
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(
          `[${method}] No token provided in WebSocket connection`,
        );
        throw new WsException("Unauthorized: No token provided");
      }

      // Verify and decode token
      const secret = this.configService.get<string>("JWT_SECRET");
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      if (!payload?.sub) {
        this.logger.warn(`[${method}] Invalid token payload`);
        throw new WsException("Unauthorized: Invalid token");
      }

      // Attach user data to socket for later use
      client.data.user = {
        sub: payload.sub,
        storeId: payload.storeId,
      };

      this.logger.log(
        `[${method}] WebSocket authenticated for user: ${payload.sub}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `[${method}] WebSocket authentication failed`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException("Unauthorized: Invalid or expired token");
    }
  }

  /**
   * Extract JWT token from WebSocket connection
   * Tries multiple sources in order:
   * 1. Authorization header
   * 2. Query parameter
   * 3. Handshake auth object
   */
  private extractToken(client: AuthenticatedSocket): string | null {
    // 1. Try Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // 2. Try query parameter
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === "string") {
      return queryToken;
    }

    // 3. Try auth object
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string") {
      return authToken;
    }

    return null;
  }
}
