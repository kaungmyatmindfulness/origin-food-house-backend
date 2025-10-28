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
import { Server, Socket } from "socket.io";

import { CartService } from "./cart.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

/**
 * WebSocket Gateway for real-time cart synchronization
 * Allows multiple devices in the same session to see live cart updates
 */
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // This will be configured dynamically via ConfigService in constructor
      callback(null, true);
    },
    credentials: true,
  },
  namespace: "/cart",
})
export class CartGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CartGateway.name);
  private readonly allowedOrigins: string[];

  constructor(
    private readonly cartService: CartService,
    private readonly configService: ConfigService,
  ) {
    const corsOrigin = this.configService.get<string>(
      "CORS_ORIGIN",
      "http://localhost:3001",
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
   * Client joins a session room for real-time updates
   */
  @SubscribeMessage("cart:join")
  async handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const method = "handleJoinSession";

    try {
      const { sessionId } = data;

      if (!sessionId) {
        client.emit("cart:error", { message: "Session ID is required" });
        return;
      }

      // Join room for this session
      await client.join(`session-${sessionId}`);

      this.logger.log(
        `[${method}] Client ${client.id} joined session ${sessionId}`,
      );

      // Send current cart state
      const cart = await this.cartService.getCart(sessionId);
      client.emit("cart:updated", cart);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to join session";
      this.logger.error(
        `[${method}] Failed to join session`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit("cart:error", {
        message: errorMessage,
      });
    }
  }

  /**
   * Add item to cart and broadcast to all devices in session
   */
  @SubscribeMessage("cart:add")
  async handleAddToCart(
    @MessageBody() data: { sessionId: string; item: AddToCartDto },
    @ConnectedSocket() client: Socket,
  ) {
    const method = "handleAddToCart";

    try {
      const { sessionId, item } = data;

      if (!sessionId || !item) {
        client.emit("cart:error", { message: "Invalid request data" });
        return;
      }

      // Add item to cart
      const cart = await this.cartService.addItem(sessionId, item);

      // Broadcast updated cart to all devices in session
      this.server.to(`session-${sessionId}`).emit("cart:updated", cart);

      this.logger.log(
        `[${method}] Item added to cart for session ${sessionId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add item to cart";
      this.logger.error(
        `[${method}] Failed to add item to cart`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit("cart:error", {
        message: errorMessage,
      });
    }
  }

  /**
   * Update cart item and broadcast to all devices in session
   */
  @SubscribeMessage("cart:update")
  async handleUpdateCartItem(
    @MessageBody()
    data: {
      sessionId: string;
      cartItemId: string;
      updates: UpdateCartItemDto;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const method = "handleUpdateCartItem";

    try {
      const { sessionId, cartItemId, updates } = data;

      if (!sessionId || !cartItemId || !updates) {
        client.emit("cart:error", { message: "Invalid request data" });
        return;
      }

      // Update cart item
      const cart = await this.cartService.updateItem(
        sessionId,
        cartItemId,
        updates,
      );

      // Broadcast updated cart to all devices in session
      this.server.to(`session-${sessionId}`).emit("cart:updated", cart);

      this.logger.log(
        `[${method}] Cart item ${cartItemId} updated for session ${sessionId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update cart item";
      this.logger.error(
        `[${method}] Failed to update cart item`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit("cart:error", {
        message: errorMessage,
      });
    }
  }

  /**
   * Remove item from cart and broadcast to all devices in session
   */
  @SubscribeMessage("cart:remove")
  async handleRemoveFromCart(
    @MessageBody() data: { sessionId: string; cartItemId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const method = "handleRemoveFromCart";

    try {
      const { sessionId, cartItemId } = data;

      if (!sessionId || !cartItemId) {
        client.emit("cart:error", { message: "Invalid request data" });
        return;
      }

      // Remove item from cart
      const cart = await this.cartService.removeItem(sessionId, cartItemId);

      // Broadcast updated cart to all devices in session
      this.server.to(`session-${sessionId}`).emit("cart:updated", cart);

      this.logger.log(
        `[${method}] Item ${cartItemId} removed from cart for session ${sessionId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to remove item from cart";
      this.logger.error(
        `[${method}] Failed to remove item from cart`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit("cart:error", {
        message: errorMessage,
      });
    }
  }

  /**
   * Clear all items from cart and broadcast to all devices in session
   */
  @SubscribeMessage("cart:clear")
  async handleClearCart(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const method = "handleClearCart";

    try {
      const { sessionId } = data;

      if (!sessionId) {
        client.emit("cart:error", { message: "Session ID is required" });
        return;
      }

      // Clear cart
      const cart = await this.cartService.clearCart(sessionId);

      // Broadcast updated cart to all devices in session
      this.server.to(`session-${sessionId}`).emit("cart:updated", cart);

      this.logger.log(`[${method}] Cart cleared for session ${sessionId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to clear cart";
      this.logger.error(
        `[${method}] Failed to clear cart`,
        error instanceof Error ? error.stack : String(error),
      );
      client.emit("cart:error", {
        message: errorMessage,
      });
    }
  }
}
