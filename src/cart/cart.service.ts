import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, Role, SessionStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { CartResponseDto } from "./dto/cart-response.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Validate session access for cart operations
   * - For Self Ordering System (customers): Verify session token matches
   * - For Restaurant Management System (staff): Verify user has store permission
   * @private
   */
  private async validateSessionAccess(
    sessionId: string,
    sessionToken?: string,
    userId?: string,
  ): Promise<void> {
    const method = this.validateSessionAccess.name;

    // Get session with related data
    const session = await this.prisma.activeTableSession.findUnique({
      where: { id: sessionId },
      include: {
        table: {
          include: {
            store: true,
          },
        },
      },
    });

    if (!session) {
      this.logger.warn(`[${method}] Session not found: ${sessionId}`);
      throw new NotFoundException("Session not found");
    }

    // Check session is active
    if (session.status !== SessionStatus.ACTIVE) {
      this.logger.warn(
        `[${method}] Attempt to access closed session: ${sessionId}`,
      );
      throw new BadRequestException("Session is closed and cannot be modified");
    }

    // If no authentication provided, deny access
    if (!sessionToken && !userId) {
      this.logger.warn(
        `[${method}] No authentication provided for session: ${sessionId}`,
      );
      throw new UnauthorizedException("Authentication required to access cart");
    }

    // For SOS app (customer): Verify session token
    if (sessionToken) {
      if (session.sessionToken !== sessionToken) {
        this.logger.warn(
          `[${method}] Invalid session token for session: ${sessionId}`,
        );
        throw new ForbiddenException(
          "Invalid session token. You do not have access to this cart.",
        );
      }

      this.logger.log(
        `[${method}] Session token validated for session: ${sessionId}`,
      );
      return;
    }

    // For Restaurant Management System (staff): Verify user has access to store
    if (userId) {
      try {
        await this.authService.checkStorePermission(userId, session.storeId, [
          Role.OWNER,
          Role.ADMIN,
          Role.CHEF,
          Role.CASHIER,
          Role.SERVER,
        ]);

        this.logger.log(
          `[${method}] User ${userId} authorized to access session: ${sessionId}`,
        );
      } catch (_error) {
        this.logger.warn(
          `[${method}] User ${userId} does not have permission for store: ${session.storeId}`,
        );
        throw new ForbiddenException(
          "You do not have permission to access this store cart",
        );
      }
    }
  }

  /**
   * Get or create cart for a session
   */
  async getCart(
    sessionId: string,
    sessionToken?: string,
    userId?: string,
  ): Promise<CartResponseDto> {
    const method = this.getCart.name;

    try {
      // Validate session access
      await this.validateSessionAccess(sessionId, sessionToken, userId);

      // Get session
      const session = await this.prisma.activeTableSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new NotFoundException("Session not found");
      }

      // Get or create cart
      let cart = await this.prisma.cart.findUnique({
        where: { sessionId },
        include: {
          items: {
            include: {
              customizations: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!cart) {
        this.logger.log(
          `[${method}] Creating new cart for session ${sessionId}`,
        );
        cart = await this.prisma.cart.create({
          data: {
            sessionId,
            storeId: session.storeId,
            subTotal: new Decimal("0"),
          },
          include: {
            items: {
              include: {
                customizations: true,
              },
            },
          },
        });
      }

      return cart as CartResponseDto;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to get cart`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to retrieve cart");
    }
  }

  /**
   * Add item to cart with customizations
   */
  async addItem(
    sessionId: string,
    dto: AddToCartDto,
    sessionToken?: string,
    userId?: string,
  ): Promise<CartResponseDto> {
    const method = this.addItem.name;

    try {
      // Validate session access
      await this.validateSessionAccess(sessionId, sessionToken, userId);

      // Get session
      const session = await this.prisma.activeTableSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        throw new NotFoundException("Session not found");
      }

      // Get menu item
      const menuItem = await this.prisma.menuItem.findUnique({
        where: { id: dto.menuItemId },
        include: {
          customizationGroups: {
            include: {
              customizationOptions: true,
            },
          },
        },
      });

      if (!menuItem) {
        throw new NotFoundException("Menu item not found");
      }

      if (menuItem.isOutOfStock) {
        throw new BadRequestException("Menu item is out of stock");
      }

      if (menuItem.isHidden || menuItem.deletedAt) {
        throw new BadRequestException("Menu item is not available");
      }

      // Validate customizations
      if (dto.customizations && dto.customizations.length > 0) {
        const optionIds = dto.customizations.map(
          (c) => c.customizationOptionId,
        );
        const options = await this.prisma.customizationOption.findMany({
          where: { id: { in: optionIds } },
        });

        if (options.length !== optionIds.length) {
          throw new BadRequestException("Invalid customization options");
        }
      }

      // Use transaction to create cart item
      const result = await this.prisma.$transaction(async (tx) => {
        // Get or create cart
        let cart = await tx.cart.findUnique({
          where: { sessionId },
        });

        cart ??= await tx.cart.create({
          data: {
            sessionId,
            storeId: session.storeId,
            subTotal: new Decimal("0"),
          },
        });

        // Create cart item
        const cartItem = await tx.cartItem.create({
          data: {
            cartId: cart.id,
            menuItemId: menuItem.id,
            menuItemName: menuItem.name,
            basePrice: menuItem.basePrice,
            quantity: dto.quantity,
            notes: dto.notes,
          },
        });

        // Add customizations
        if (dto.customizations && dto.customizations.length > 0) {
          const customizationData = await Promise.all(
            dto.customizations.map(async (c) => {
              const option = await tx.customizationOption.findUnique({
                where: { id: c.customizationOptionId },
              });

              return {
                cartItemId: cartItem.id,
                customizationOptionId: c.customizationOptionId,
                optionName: option!.name,
                additionalPrice: option!.additionalPrice,
              };
            }),
          );

          await tx.cartItemCustomization.createMany({
            data: customizationData,
          });
        }

        // Recalculate cart total
        const updatedCart = await this.recalculateCartTotal(tx, cart.id);

        return updatedCart;
      });

      this.logger.log(
        `[${method}] Added item ${menuItem.name} to cart ${result.id}`,
      );

      // Return full cart with items
      return await this.getCart(sessionId, sessionToken, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to add item to cart`,
        error instanceof Error ? error.stack : String(error),
      );

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          throw new BadRequestException("Invalid reference");
        }
      }

      throw new InternalServerErrorException("Failed to add item to cart");
    }
  }

  /**
   * Update cart item
   */
  async updateItem(
    sessionId: string,
    cartItemId: string,
    dto: UpdateCartItemDto,
    sessionToken?: string,
    userId?: string,
  ): Promise<CartResponseDto> {
    const method = this.updateItem.name;

    try {
      // Validate session access
      await this.validateSessionAccess(sessionId, sessionToken, userId);

      // Verify cart item belongs to session
      const cartItem = await this.prisma.cartItem.findUnique({
        where: { id: cartItemId },
        include: { cart: true },
      });

      if (!cartItem) {
        throw new NotFoundException("Cart item not found");
      }

      if (cartItem.cart.sessionId !== sessionId) {
        throw new BadRequestException(
          "Cart item does not belong to this session",
        );
      }

      // Update item
      await this.prisma.$transaction(async (tx) => {
        await tx.cartItem.update({
          where: { id: cartItemId },
          data: {
            quantity: dto.quantity,
            notes: dto.notes,
          },
        });

        // Recalculate cart total
        await this.recalculateCartTotal(tx, cartItem.cartId);
      });

      this.logger.log(`[${method}] Updated cart item ${cartItemId}`);

      return await this.getCart(sessionId, sessionToken, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to update cart item`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to update cart item");
    }
  }

  /**
   * Remove item from cart
   * NOTE: Performs HARD DELETE as cart items are transient session data.
   * Cart items are temporary and converted to OrderItems upon checkout,
   * where they are preserved as historical records. No audit trail needed.
   */
  async removeItem(
    sessionId: string,
    cartItemId: string,
    sessionToken?: string,
    userId?: string,
  ): Promise<CartResponseDto> {
    const method = this.removeItem.name;

    try {
      // Validate session access
      await this.validateSessionAccess(sessionId, sessionToken, userId);

      // Verify cart item belongs to session
      const cartItem = await this.prisma.cartItem.findUnique({
        where: { id: cartItemId },
        include: { cart: true },
      });

      if (!cartItem) {
        throw new NotFoundException("Cart item not found");
      }

      if (cartItem.cart.sessionId !== sessionId) {
        throw new BadRequestException(
          "Cart item does not belong to this session",
        );
      }

      // Delete item (cascade will remove customizations)
      await this.prisma.$transaction(async (tx) => {
        await tx.cartItem.delete({
          where: { id: cartItemId },
        });

        // Recalculate cart total
        await this.recalculateCartTotal(tx, cartItem.cartId);
      });

      this.logger.log(`[${method}] Removed cart item ${cartItemId}`);

      return await this.getCart(sessionId, sessionToken, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to remove cart item`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to remove cart item");
    }
  }

  /**
   * Clear all items from cart
   * NOTE: Performs HARD DELETE as cart items are transient session data.
   * Clearing cart is a user-initiated action with no need for audit trail.
   */
  async clearCart(
    sessionId: string,
    sessionToken?: string,
    userId?: string,
  ): Promise<CartResponseDto> {
    const method = this.clearCart.name;

    try {
      // Validate session access
      await this.validateSessionAccess(sessionId, sessionToken, userId);

      const cart = await this.prisma.cart.findUnique({
        where: { sessionId },
      });

      if (!cart) {
        throw new NotFoundException("Cart not found");
      }

      await this.prisma.$transaction(async (tx) => {
        // Delete all cart items (cascade will remove customizations)
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        });

        // Reset cart total
        await tx.cart.update({
          where: { id: cart.id },
          data: { subTotal: new Decimal("0") },
        });
      });

      this.logger.log(`[${method}] Cleared cart ${cart.id}`);

      return await this.getCart(sessionId, sessionToken, userId);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.error(
        `[${method}] Failed to clear cart`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException("Failed to clear cart");
    }
  }

  /**
   * Recalculate cart subtotal
   * @private
   */
  private async recalculateCartTotal(
    tx: Prisma.TransactionClient,
    cartId: string,
  ) {
    const cartItems = await tx.cartItem.findMany({
      where: { cartId },
      include: { customizations: true },
    });

    let subTotal = new Decimal("0");

    for (const item of cartItems) {
      // Item base price * quantity
      let itemTotal = new Decimal(item.basePrice).mul(item.quantity);

      // Add customization prices
      for (const customization of item.customizations) {
        if (customization.additionalPrice) {
          itemTotal = itemTotal.add(
            new Decimal(customization.additionalPrice).mul(item.quantity),
          );
        }
      }

      subTotal = subTotal.add(itemTotal);
    }

    // Update cart
    return await tx.cart.update({
      where: { id: cartId },
      data: { subTotal },
      include: {
        items: {
          include: { customizations: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }
}
