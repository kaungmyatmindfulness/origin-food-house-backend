import {
  UseGuards,
  UsePipes,
  ValidationPipe,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import {
  BaseGateway,
  SocketWithSession,
} from '../common/gateways/base.gateway';
import { CustomerSessionJwtAuthGuard } from '../auth/guards/customer-session-jwt.guard';
import { CartService, CartWithDetails } from './cart.service';
import { AddItemToCartDto } from './dto/add-item-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { RemoveCartItemDto } from './dto/remove-cart-item.dto';

const CART_EVENT_PREFIX = 'cart:';
const GET_CART_EVENT = `${CART_EVENT_PREFIX}get`;
const ADD_ITEM_EVENT = `${CART_EVENT_PREFIX}add`;
const UPDATE_ITEM_EVENT = `${CART_EVENT_PREFIX}update`;
const REMOVE_ITEM_EVENT = `${CART_EVENT_PREFIX}remove`;
const CLEAR_CART_EVENT = `${CART_EVENT_PREFIX}clear`;
export const CART_UPDATED_EVENT = `${CART_EVENT_PREFIX}updated`;
const CART_ERROR_EVENT = `${CART_EVENT_PREFIX}error`;

@UseGuards(CustomerSessionJwtAuthGuard)
@UsePipes(new ValidationPipe())
@WebSocketGateway({})
export class CartGateway extends BaseGateway {
  constructor(
    @Inject(forwardRef(() => CartService))
    private readonly cartService: CartService,
  ) {
    super(CartGateway.name);
  }

  /**
   * Public method for the CartService to call to emit updates.
   * @param sessionId The session ID to target the room.
   * @param cartData The updated cart data (consider mapping to DTO).
   */
  emitCartUpdate(sessionId: string, cartData: CartWithDetails | null) {
    this.emitToSession(sessionId, CART_UPDATED_EVENT, cartData);
  }

  /**
   * Handles request to get the current cart contents.
   * Emits the result directly back to the requesting client.
   */
  @SubscribeMessage(GET_CART_EVENT)
  async handleGetCart(
    @ConnectedSocket() client: SocketWithSession,
  ): Promise<void> {
    const method = this.handleGetCart.name;
    const sessionContext = this.getSessionContext(client);
    const sessionId = sessionContext.sessionId;
    this.logger.log(
      `[${method}] Received from Session ${sessionId} (Client: ${client.id})`,
    );
    await this.joinSessionRoom(client, sessionId);

    try {
      const cart = await this.cartService.getCart(sessionId);

      client.emit(CART_UPDATED_EVENT, cart);
    } catch (error) {
      this.logger.error(
        `[${method}] Failed for Session ${sessionId}: ${error.message}`,
        error.stack,
      );
      client.emit(CART_ERROR_EVENT, { message: 'Failed to retrieve cart.' });
    }
  }

  /**
   * Handles request to add an item to the cart.
   * Service will handle emitting the update.
   */
  @SubscribeMessage(ADD_ITEM_EVENT)
  async handleAddItem(
    @ConnectedSocket() client: SocketWithSession,
    @MessageBody() payload: AddItemToCartDto,
  ): Promise<void> {
    const method = this.handleAddItem.name;
    const sessionContext = this.getSessionContext(client);
    const sessionId = sessionContext.sessionId;
    this.logger.log(
      `[${method}] Session ${sessionId} adding item: ${payload.menuItemId}`,
    );
    await this.joinSessionRoom(client, sessionId);

    try {
      await this.cartService.addItemToCart(sessionId, payload);
    } catch (error) {
      this.logger.error(
        `[${method}] Failed for Session ${sessionId}: ${error.message}`,
        error.stack,
      );
      client.emit(CART_ERROR_EVENT, {
        event: ADD_ITEM_EVENT,
        message: error.message || 'Failed to add item to cart.',
        details:
          error instanceof BadRequestException ||
          error instanceof NotFoundException
            ? error.getResponse()
            : undefined,
      });
    }
  }

  /**
   * Handles request to update quantity/notes of a cart item.
   * Service will handle emitting the update.
   */
  @SubscribeMessage(UPDATE_ITEM_EVENT)
  async handleUpdateItem(
    @ConnectedSocket() client: SocketWithSession,
    @MessageBody() payload: UpdateCartItemDto,
  ): Promise<void> {
    const method = this.handleUpdateItem.name;
    const sessionContext = this.getSessionContext(client);
    const sessionId = sessionContext.sessionId;
    this.logger.log(
      `[${method}] Session ${sessionId} updating item: ${payload.cartItemId}`,
    );
    await this.joinSessionRoom(client, sessionId);

    try {
      await this.cartService.updateCartItem(sessionId, payload.cartItemId, {
        quantity: payload.quantity,
        notes: payload.notes,
      });
    } catch (error) {
      this.logger.error(
        `[${method}] Failed for Session ${sessionId}: ${error.message}`,
        error.stack,
      );
      client.emit(CART_ERROR_EVENT, {
        event: UPDATE_ITEM_EVENT,
        message: error.message || 'Failed to update cart item.',
        details:
          error instanceof BadRequestException ||
          error instanceof NotFoundException
            ? error.getResponse()
            : undefined,
      });
    }
  }

  /**
   * Handles request to remove an item from the cart.
   * Service will handle emitting the update.
   */
  @SubscribeMessage(REMOVE_ITEM_EVENT)
  async handleRemoveItem(
    @ConnectedSocket() client: SocketWithSession,
    @MessageBody() payload: RemoveCartItemDto,
  ): Promise<void> {
    const method = this.handleRemoveItem.name;
    const sessionContext = this.getSessionContext(client);
    const sessionId = sessionContext.sessionId;
    this.logger.log(
      `[${method}] Session ${sessionId} removing item: ${payload.cartItemId}`,
    );
    await this.joinSessionRoom(client, sessionId);

    try {
      await this.cartService.removeItemFromCart(sessionId, payload.cartItemId);
    } catch (error) {
      this.logger.error(
        `[${method}] Failed for Session ${sessionId}: ${error.message}`,
        error.stack,
      );
      client.emit(CART_ERROR_EVENT, {
        event: REMOVE_ITEM_EVENT,
        message: error.message || 'Failed to remove cart item.',
        details:
          error instanceof NotFoundException ? error.getResponse() : undefined,
      });
    }
  }

  /**
   * Handles request to clear all items from the cart.
   * Service will handle emitting the update.
   */
  @SubscribeMessage(CLEAR_CART_EVENT)
  async handleClearCart(
    @ConnectedSocket() client: SocketWithSession,
  ): Promise<void> {
    const sessionContext = this.getSessionContext(client);
    const sessionId = sessionContext.sessionId;
    this.logger.log(`[${CLEAR_CART_EVENT}] Session ${sessionId} clearing cart`);
    await this.joinSessionRoom(client, sessionId);

    try {
      await this.cartService.clearCart(sessionId);
    } catch (error) {
      this.logger.error(
        `[${CLEAR_CART_EVENT}] Failed for Session ${sessionId}: ${error.message}`,
        error.stack,
      );
      client.emit(CART_ERROR_EVENT, {
        event: CLEAR_CART_EVENT,
        message: error.message || 'Failed to clear cart.',
        details:
          error instanceof NotFoundException ? error.getResponse() : undefined,
      });
    }
  }
}
