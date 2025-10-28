import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Table } from "@prisma/client";
import { Server, Socket } from "socket.io";

/**
 * WebSocket Gateway for real-time table status synchronization
 * Broadcasts table status updates to all staff devices in a store
 */
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // This will be configured dynamically via ConfigService in constructor
      callback(null, true);
    },
    credentials: true,
  },
  namespace: "/table",
})
export class TableGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TableGateway.name);
  private readonly allowedOrigins: string[];

  constructor(private readonly configService: ConfigService) {
    const corsOrigin = this.configService.get<string>(
      "CORS_ORIGIN",
      "http://localhost:3001,http://localhost:3002",
    );
    this.allowedOrigins = corsOrigin.split(",").map((origin) => origin.trim());
    this.logger.log(
      `[constructor] CORS origins configured: ${this.allowedOrigins.join(", ")}`,
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
   * Staff client joins a store room for table status updates
   */
  @SubscribeMessage("table:join-store")
  async handleJoinStore(
    @MessageBody() data: { storeId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const method = "handleJoinStore";

    try {
      const { storeId } = data;

      if (!storeId) {
        client.emit("table:error", { message: "Store ID is required" });
        return;
      }

      // Join room for this store
      await client.join(`store-${storeId}`);

      this.logger.log(
        `[${method}] Client ${client.id} joined store-${storeId} room`,
      );

      client.emit("table:joined", { storeId });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to join store";
      this.logger.error(
        `[${method}] Failed to join store`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit("table:error", {
        message: errorMessage,
      });
    }
  }

  /**
   * Broadcast table status update to all staff in a store
   * This is called by TableService when table status changes
   */
  broadcastTableStatusUpdate(storeId: string, table: Table) {
    const method = "broadcastTableStatusUpdate";

    this.logger.log(
      `[${method}] Broadcasting table ${table.id} status update to store-${storeId}`,
    );

    // Emit to all devices in the store room
    this.server.to(`store-${storeId}`).emit("table:status-updated", table);
  }

  /**
   * Broadcast table creation to all staff in a store
   */
  broadcastTableCreated(storeId: string, table: Table) {
    const method = "broadcastTableCreated";

    this.logger.log(
      `[${method}] Broadcasting table ${table.id} creation to store-${storeId}`,
    );

    this.server.to(`store-${storeId}`).emit("table:created", table);
  }

  /**
   * Broadcast table deletion to all staff in a store
   */
  broadcastTableDeleted(storeId: string, tableId: string) {
    const method = "broadcastTableDeleted";

    this.logger.log(
      `[${method}] Broadcasting table ${tableId} deletion to store-${storeId}`,
    );

    this.server.to(`store-${storeId}`).emit("table:deleted", { id: tableId });
  }

  /**
   * Broadcast table update (name change) to all staff in a store
   */
  broadcastTableUpdated(storeId: string, table: Table) {
    const method = "broadcastTableUpdated";

    this.logger.log(
      `[${method}] Broadcasting table ${table.id} update to store-${storeId}`,
    );

    this.server.to(`store-${storeId}`).emit("table:updated", table);
  }
}
