import { Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';
import { UpdateKitchenStatusDto } from '../dto/update-kitchen-status.dto';
import { KitchenService } from '../kitchen.service';

/**
 * WebSocket Gateway for Kitchen Display System (KDS)
 * Provides real-time order updates to kitchen screens
 * Requires JWT authentication for all operations
 */
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // This will be configured dynamically via ConfigService in constructor
      callback(null, true);
    },
    credentials: true,
  },
  namespace: '/kitchen',
})
@UseGuards(WsJwtGuard)
export class KitchenGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KitchenGateway.name);
  private readonly allowedOrigins: string[];

  constructor(
    private readonly kitchenService: KitchenService,
    private readonly configService: ConfigService,
  ) {
    const corsOrigin = this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:3002',
    );
    this.allowedOrigins = corsOrigin.split(',').map((origin) => origin.trim());
    this.logger.log(
      `[constructor] CORS origins configured: ${this.allowedOrigins.join(', ')}`,
    );
  }

  /**
   * Handle client connection
   */
  handleConnection(client: Socket) {
    this.logger.log(`[handleConnection] Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`[handleDisconnect] Client disconnected: ${client.id}`);
  }

  /**
   * Kitchen screen joins store room for real-time updates
   * Validates that user has access to the requested store
   */
  @SubscribeMessage('kitchen:join')
  async handleJoinStore(
    @MessageBody() data: { storeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const method = 'handleJoinStore';

    try {
      const { storeId } = data;
      const { user } = client.data;

      if (!storeId) {
        client.emit('kitchen:error', { message: 'Store ID is required' });
        return;
      }

      // Verify user has access to this store
      if (user?.storeId !== storeId) {
        this.logger.warn(
          `[${method}] User ${user?.sub} attempted to join unauthorized store ${storeId}`,
        );
        client.emit('kitchen:error', {
          message: 'Unauthorized: You do not have access to this store',
        });
        return;
      }

      // Join room for this store
      await client.join(`store-${storeId}`);

      this.logger.log(
        `[${method}] Client ${client.id} (User: ${user.sub}) joined store ${storeId}`,
      );

      client.emit('kitchen:joined', { storeId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to join store';
      this.logger.error(
        `[${method}] Failed to join store`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit('kitchen:error', {
        message: errorMessage,
      });
    }
  }

  /**
   * Update order status and broadcast to all kitchen screens
   */
  @SubscribeMessage('kitchen:update-status')
  async handleUpdateStatus(
    @MessageBody()
    data: {
      orderId: string;
      storeId: string;
      status: UpdateKitchenStatusDto;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const method = 'handleUpdateStatus';

    try {
      const { orderId, storeId, status } = data;

      if (!orderId || !storeId || !status) {
        client.emit('kitchen:error', { message: 'Invalid request data' });
        return;
      }

      // Update order status
      const updatedOrder = await this.kitchenService.updateOrderStatus(
        orderId,
        storeId,
        status,
      );

      // Broadcast to all kitchen screens in the store
      this.server
        .to(`store-${storeId}`)
        .emit('kitchen:status-updated', updatedOrder);

      this.logger.log(
        `[${method}] Order ${orderId} status updated to ${status.status}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update status';
      this.logger.error(
        `[${method}] Failed to update order status`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit('kitchen:error', {
        message: errorMessage,
      });
    }
  }

  /**
   * Broadcast new order to kitchen screens
   * Called by OrderModule when new order is created
   */
  async broadcastNewOrder(storeId: string, orderId: string) {
    const method = 'broadcastNewOrder';

    try {
      const order = await this.kitchenService.getOrderDetails(orderId);

      this.server.to(`store-${storeId}`).emit('kitchen:order-received', order);

      this.logger.log(
        `[${method}] New order ${orderId} broadcasted to store ${storeId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to broadcast new order`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Broadcast order ready notification
   * Called when kitchen marks order as READY
   */
  async broadcastOrderReady(storeId: string, orderId: string) {
    const method = 'broadcastOrderReady';

    try {
      const order = await this.kitchenService.getOrderDetails(orderId);

      this.server.to(`store-${storeId}`).emit('kitchen:order-ready', order);

      this.logger.log(
        `[${method}] Order ${orderId} ready notification sent to store ${storeId}`,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to broadcast order ready`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
