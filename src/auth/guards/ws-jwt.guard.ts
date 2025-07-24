import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

import { Request } from 'express';
import { SessionContext } from 'src/auth/customer-session-jwt.strategy';

const ERROR_EVENT = 'error';

/**
 * Extracts JWT from various sources during WebSocket handshake.
 */
function extractTokenFromHandshake(client: Socket): string | null {
  const logger = new Logger('WsTokenExtractor');
  let token: string | null = null;

  const authHeader = client.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    if (token) {
      logger.debug(`Token found in handshake header for client ${client.id}`);
      return token;
    }
  }

  if (!token && typeof client.handshake.query?.token === 'string') {
    token = client.handshake.query.token;
    if (token) {
      logger.debug(`Token found in handshake query for client ${client.id}`);
      return token;
    }
  }

  try {
    const request = client.request as Request & {
      cookies?: Record<string, string>;
    };
    if (!token && request?.cookies) {
      token = request.cookies['session_token'];
      if (token) {
        logger.debug(`Token found in handshake cookie for client ${client.id}`);
        return token;
      }
    }
  } catch (e) {
    logger.warn(
      `Could not access cookies from handshake request for client ${client.id}`,
      e?.message,
    );
  }

  return null;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('WsJwtGuard initialized.');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = extractTokenFromHandshake(client);

    if (!token) {
      this.logger.warn(
        `WS Auth: No session token found for client ${client.id}. Disconnecting.`,
      );
      this.disconnectClient(client, 'Authentication token missing.');
      return false;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);

      if (!payload || typeof payload.sub !== 'string') {
        this.logger.warn(
          `WS Auth: Invalid token payload structure for client ${client.id}. Disconnecting.`,
        );
        this.disconnectClient(client, 'Invalid token payload.');
        return false;
      }

      (client as any).sessionContext = {
        sessionId: payload.sub,
      } as SessionContext;

      this.logger.verbose(
        `WS Auth: Client ${client.id} authenticated for session ${payload.sub}.`,
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `WS Auth: Token validation failed for client ${client.id}: ${(error as Error).message ?? (error as Error).name}. Disconnecting.`,
      );
      let disconnectMsg = 'Authentication failed.';
      if ((error as Error).name === 'TokenExpiredError') {
        disconnectMsg = 'Session token expired.';
      } else if ((error as Error).name === 'JsonWebTokenError') {
        disconnectMsg = 'Invalid session token.';
      }
      this.disconnectClient(client, disconnectMsg);
      return false;
    }
  }

  /** Helper to emit error and disconnect client */
  private disconnectClient(client: Socket, message: string): void {
    client.emit(ERROR_EVENT, { message: message || 'Unauthorized' });

    setTimeout(() => client.disconnect(true), 50);
  }
}
