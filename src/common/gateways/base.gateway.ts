import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { SessionContext } from 'src/auth/customer-session-jwt.strategy';

export interface SocketWithSession extends Socket {
  sessionContext?: SessionContext;
}

export const ERROR_EVENT = 'error';
export const AUTH_ERROR_EVENT = 'authError';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export abstract class BaseGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  protected readonly logger: Logger;

  constructor(loggerName: string) {
    this.logger = new Logger(loggerName);
  }

  afterInit(_server: Server) {
    this.logger.log(`WebSocket Gateway Initialized: ${this.constructor.name}`);
  }

  handleConnection(client: SocketWithSession, ..._args: unknown[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: SocketWithSession) {
    const sessionId = client.sessionContext?.sessionId;
    this.logger.log(
      `Client disconnected: ${client.id}${sessionId ? ` (Session: ${sessionId})` : ''}`,
    );
  }

  protected getSessionContext(client: SocketWithSession): SessionContext {
    const context = client.sessionContext;
    if (!context?.sessionId) {
      this.logger.error(
        `Session context missing for client ${client.id} in protected handler! Should have been attached by guard.`,
      );

      throw new WsException(
        'Session context unavailable or authentication failed.',
      );
    }
    return context;
  }

  protected emitToSession(sessionId: string, event: string, data: unknown) {
    const roomName = `session_${sessionId}`;
    this.logger.debug(`Emitting event '${event}' to room '${roomName}'`);
    this.server.to(roomName).emit(event, data);
  }

  protected async joinSessionRoom(
    client: SocketWithSession,
    sessionId: string,
  ) {
    const roomName = `session_${sessionId}`;
    await client.join(roomName);
    this.logger.log(`Client ${client.id} joined room ${roomName}`);
  }
}
