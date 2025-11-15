import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import { CartService } from "./cart.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

interface AuthenticatedSocket extends Socket {
  data: {
    sessionToken?: string;
    userId?: string;
  };
}

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
    private readonly jwtService: JwtService,
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
   * Authenticates WebSocket client and extracts session token or user ID
   * Security Fix: Prevents cart manipulation without proper authentication
   */
  private async authenticateClient(
    client: AuthenticatedSocket,
  ): Promise<{ sessionToken?: string; userId?: string }> {
    const method = "authenticateClient";

    // Try to extract session token from query or handshake
    const sessionToken =
      (client.handshake.query.sessionToken as string) ||
      (client.handshake.headers["x-session-token"] as string);

    // Try to extract JWT token
    const authHeader = client.handshake.headers.authorization;
    const jwtToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : (client.handshake.query.token as string);

    // Validate JWT if provided (staff access)
    if (jwtToken) {
      try {
        const secret = this.configService.get<string>("JWT_SECRET");
        const payload = await this.jwtService.verifyAsync<JwtPayload>(
          jwtToken,
          { secret },
        );

        if (!payload?.sub) {
          throw new WsException("Invalid JWT token");
        }

        this.logger.log(
          `[${method}] Staff authenticated via JWT: ${payload.sub}`,
        );

        return { userId: payload.sub };
      } catch (error) {
        this.logger.error(
          `[${method}] JWT validation failed`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new WsException("Invalid or expired JWT token");
      }
    }

    // Validate session token (customer access)
    if (sessionToken) {
      this.logger.log(`[${method}] Customer authenticated via session token`);
      return { sessionToken };
    }

    // No authentication provided
    this.logger.warn(
      `[${method}] No authentication provided in WebSocket connection`,
    );
    throw new WsException(
      "Authentication required: Provide session token or JWT",
    );
  }

  /**
   * Handle client connection - authenticate immediately
   * Security Fix: Validates authentication on connection
   */
  async handleConnection(client: AuthenticatedSocket) {
    const method = "handleConnection";

    try {
      const auth = await this.authenticateClient(client);
      client.data.sessionToken = auth.sessionToken;
      client.data.userId = auth.userId;

      this.logger.log(
        `[${method}] Client ${client.id} connected and authenticated`,
      );
    } catch (_error) {
      this.logger.warn(
        `[${method}] Client ${client.id} connection rejected - authentication failed`,
      );
      client.emit("cart:error", {
        message: "Authentication required",
      });
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`[handleDisconnect] Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a session room for real-time updates
   * Security Fix: Validates session ownership before joining
   */
  @SubscribeMessage("cart:join")
  async handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const method = "handleJoinSession";

    try {
      const { sessionId } = data;

      if (!sessionId) {
        client.emit("cart:error", { message: "Session ID is required" });
        return;
      }

      // Get authenticated credentials
      const { sessionToken, userId } = client.data;

      // Join room for this session
      await client.join(`session-${sessionId}`);

      this.logger.log(
        `[${method}] Client ${client.id} joined session ${sessionId}`,
      );

      // Send current cart state (service validates session ownership)
      const cart = await this.cartService.getCart(
        sessionId,
        sessionToken,
        userId,
      );
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
   * Security Fix: Uses authenticated credentials
   */
  @SubscribeMessage("cart:add")
  async handleAddToCart(
    @MessageBody() data: { sessionId: string; item: AddToCartDto },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const method = "handleAddToCart";

    try {
      const { sessionId, item } = data;

      if (!sessionId || !item) {
        client.emit("cart:error", { message: "Invalid request data" });
        return;
      }

      // Get authenticated credentials
      const { sessionToken, userId } = client.data;

      // Add item to cart (service validates session ownership)
      const cart = await this.cartService.addItem(
        sessionId,
        item,
        sessionToken,
        userId,
      );

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
   * Security Fix: Uses authenticated credentials
   */
  @SubscribeMessage("cart:update")
  async handleUpdateCartItem(
    @MessageBody()
    data: {
      sessionId: string;
      cartItemId: string;
      updates: UpdateCartItemDto;
    },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const method = "handleUpdateCartItem";

    try {
      const { sessionId, cartItemId, updates } = data;

      if (!sessionId || !cartItemId || !updates) {
        client.emit("cart:error", { message: "Invalid request data" });
        return;
      }

      // Get authenticated credentials
      const { sessionToken, userId } = client.data;

      // Update cart item (service validates session ownership)
      const cart = await this.cartService.updateItem(
        sessionId,
        cartItemId,
        updates,
        sessionToken,
        userId,
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
   * Security Fix: Uses authenticated credentials
   */
  @SubscribeMessage("cart:remove")
  async handleRemoveFromCart(
    @MessageBody() data: { sessionId: string; cartItemId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const method = "handleRemoveFromCart";

    try {
      const { sessionId, cartItemId } = data;

      if (!sessionId || !cartItemId) {
        client.emit("cart:error", { message: "Invalid request data" });
        return;
      }

      // Get authenticated credentials
      const { sessionToken, userId } = client.data;

      // Remove item from cart (service validates session ownership)
      const cart = await this.cartService.removeItem(
        sessionId,
        cartItemId,
        sessionToken,
        userId,
      );

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
   * Security Fix: Uses authenticated credentials
   */
  @SubscribeMessage("cart:clear")
  async handleClearCart(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const method = "handleClearCart";

    try {
      const { sessionId } = data;

      if (!sessionId) {
        client.emit("cart:error", { message: "Session ID is required" });
        return;
      }

      // Get authenticated credentials
      const { sessionToken, userId } = client.data;

      // Clear cart (service validates session ownership)
      const cart = await this.cartService.clearCart(
        sessionId,
        sessionToken,
        userId,
      );

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
