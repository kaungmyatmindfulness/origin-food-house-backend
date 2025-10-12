import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PreparationStatus, Cart } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { PrismaService } from '../prisma/prisma.service';
import { AddItemToCartDto } from './dto/add-item-to-cart.dto';

// Define necessary includes/selects used across methods
const cartItemInclude = Prisma.validator<Prisma.CartItemInclude>()({
  menuItem: {
    select: {
      id: true,
      name: true,
      basePrice: true,
      imageUrl: true,
      isHidden: true,
      deletedAt: true,
    },
  },
  selectedOptions: { select: { id: true, name: true, additionalPrice: true } },
});

const cartInclude = Prisma.validator<Prisma.CartInclude>()({
  items: {
    include: cartItemInclude,
    orderBy: { createdAt: 'asc' },
  },
});
export type CartWithDetails = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Finds or creates Cart */
  private async findOrCreateCart(
    sessionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Cart> {
    const prismaClient = tx ?? this.prisma;
    const method = this.findOrCreateCart.name;
    this.logger.debug(
      `[${method}] Finding or creating cart for session ${sessionId}`,
    );
    try {
      const cart = await prismaClient.cart.upsert({
        where: { activeTableSessionId: sessionId },
        update: {},
        create: { activeTableSessionId: sessionId },
      });
      this.logger.verbose(
        `[${method}] Ensured cart ${cart.id} exists for session ${sessionId}`,
      );
      return cart;
    } catch (error) {
      // Handle foreign key constraint violation (session doesn't exist)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException(`Active session ${sessionId} not found.`);
      }
      throw error;
    }
  }

  /** Retrieves cart details */
  async getCart(sessionId: string): Promise<CartWithDetails | null> {
    // ... (logic to fetch or create/fetch cart remains the same) ...
    this.logger.log(`Getting cart for session ${sessionId}`);
    let cart = await this.prisma.cart.findUnique({
      where: { activeTableSessionId: sessionId },
      include: cartInclude,
    });
    if (!cart) {
      this.logger.warn(
        `Cart not found for session ${sessionId}, attempting to create.`,
      );
      try {
        await this.findOrCreateCart(sessionId);
        cart = await this.prisma.cart.findUnique({
          where: { activeTableSessionId: sessionId },
          include: cartInclude,
        });
      } catch (error) {
        this.logger.error(
          `Failed to create missing cart for session ${sessionId}`,
          error,
        );
        return null;
      }
    }
    return cart;
  }

  /** Adds item to cart and emits update */
  async addItemToCart(
    sessionId: string,
    dto: AddItemToCartDto,
  ): Promise<CartWithDetails> {
    const method = this.addItemToCart.name;
    this.logger.log(
      `[${method}] Adding item ${dto.menuItemId} (qty: ${dto.quantity}) to cart for session ${sessionId}`,
    );
    try {
      const updatedCart = await this.prisma.$transaction(async (tx) => {
        const cart = await this.findOrCreateCart(sessionId, tx);
        const menuItem = await tx.menuItem.findUnique({
          where: { id: dto.menuItemId, deletedAt: null, isHidden: false },
          select: {
            id: true,
            storeId: true,
            customizationGroups: {
              include: { customizationOptions: { select: { id: true } } },
            },
          },
        });
        if (!menuItem) {
          throw new NotFoundException(
            `Available MenuItem with ID ${dto.menuItemId} not found.`,
          );
        }
        // Validate customization options
        const validOptionIds = new Set(
          menuItem.customizationGroups.flatMap((g) =>
            g.customizationOptions.map((o) => o.id),
          ),
        );

        // Check for invalid option IDs
        const invalidIds =
          dto.selectedOptionIds?.filter((id) => !validOptionIds.has(id)) ?? [];
        if (invalidIds.length > 0) {
          throw new BadRequestException(
            `Invalid customization option IDs provided: ${invalidIds.join(', ')}`,
          );
        }

        // Validate min/max selectable constraints for each group
        for (const group of menuItem.customizationGroups) {
          const selectedInGroup =
            dto.selectedOptionIds?.filter((id) =>
              group.customizationOptions.some((opt) => opt.id === id),
            ).length ?? 0;

          // Check minimum selection requirement
          if (selectedInGroup < group.minSelectable) {
            throw new BadRequestException(
              `Customization group "${group.name}" requires at least ${group.minSelectable} selection(s), but only ${selectedInGroup} provided.`,
            );
          }

          // Check maximum selection limit
          if (selectedInGroup > group.maxSelectable) {
            throw new BadRequestException(
              `Customization group "${group.name}" allows maximum ${group.maxSelectable} selection(s), but ${selectedInGroup} provided.`,
            );
          }
        }

        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            menuItemId: dto.menuItemId,
            quantity: dto.quantity,
            notes: dto.notes,
            selectedOptions: dto.selectedOptionIds
              ? { connect: dto.selectedOptionIds.map((id) => ({ id })) }
              : undefined,
          },
        });
        return await tx.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        });
      });

      // Emit update AFTER transaction succeeds
      this.eventEmitter.emit('cart.updated', { sessionId, cart: updatedCart });
      return updatedCart;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${method}] Error adding item for session ${sessionId}: ${err.message}`,
        err.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException('Could not add item to cart.');
    }
  }

  /** Updates item and emits update */
  async updateCartItem(
    sessionId: string,
    cartItemId: string,
    updateData: { quantity?: number; notes?: string | null },
  ): Promise<CartWithDetails> {
    const method = this.updateCartItem.name;
    this.logger.log(
      `[${method}] Updating CartItem ${cartItemId} in session ${sessionId}`,
    );
    if (updateData.quantity === undefined && updateData.notes === undefined) {
      throw new BadRequestException('No update data provided.');
    }
    if (updateData.quantity !== undefined && updateData.quantity < 1) {
      throw new BadRequestException('Quantity must be at least 1.');
    }

    try {
      const updatedCart = await this.prisma.$transaction(async (tx) => {
        const cart = await this.findOrCreateCart(sessionId, tx);
        try {
          await tx.cartItem.update({
            where: { id: cartItemId, cartId: cart.id }, // Ensure item belongs to cart
            data: { quantity: updateData.quantity, notes: updateData.notes },
          });
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          ) {
            throw new NotFoundException(
              `Cart item ${cartItemId} not found in session ${sessionId}.`,
            );
          }
          throw e;
        }
        return await tx.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        });
      });

      // Emit update AFTER transaction succeeds
      this.eventEmitter.emit('cart.updated', { sessionId, cart: updatedCart });
      return updatedCart;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${method}] Error updating item ${cartItemId} for session ${sessionId}: ${err.message}`,
        err.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException('Could not update cart item.');
    }
  }

  /** Removes item and emits update */
  async removeItemFromCart(
    sessionId: string,
    cartItemId: string,
  ): Promise<CartWithDetails> {
    const method = this.removeItemFromCart.name;
    this.logger.log(
      `[${method}] Removing CartItem ${cartItemId} from cart for session ${sessionId}`,
    );
    try {
      const updatedCart = await this.prisma.$transaction(async (tx) => {
        const cart = await this.findOrCreateCart(sessionId, tx);
        try {
          await tx.cartItem.delete({
            where: { id: cartItemId, cartId: cart.id },
          }); // Ensure item belongs to cart
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2025'
          ) {
            throw new NotFoundException(
              `Cart item ${cartItemId} not found in session ${sessionId}.`,
            );
          }
          throw e;
        }
        return await tx.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        });
      });

      // Emit update AFTER transaction succeeds
      this.eventEmitter.emit('cart.updated', { sessionId, cart: updatedCart });
      return updatedCart;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${method}] Error removing item ${cartItemId} for session ${sessionId}: ${err.message}`,
        err.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Could not remove cart item.');
    }
  }

  /** Clears cart and emits update */
  async clearCart(sessionId: string): Promise<CartWithDetails> {
    const method = this.clearCart.name;
    this.logger.log(`[${method}] Clearing cart for session ${sessionId}`);
    try {
      const updatedCart = await this.prisma.$transaction(async (tx) => {
        const cart = await this.findOrCreateCart(sessionId, tx);
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        this.logger.log(`[${method}] Removed items from cart ${cart.id}`);
        // Fetch the cart again to get the empty items array structure
        return await tx.cart.findUniqueOrThrow({
          where: { id: cart.id },
          include: cartInclude,
        });
      });

      // Emit update AFTER transaction succeeds
      this.eventEmitter.emit('cart.updated', { sessionId, cart: updatedCart });
      return updatedCart;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${method}] Error clearing cart for session ${sessionId}: ${err.message}`,
        err.stack,
      );
      if (error instanceof NotFoundException) throw error; // From findOrCreateCart
      throw new InternalServerErrorException('Could not clear cart.');
    }
  }

  /** Confirms cart, creates ActiveOrderChunk, deletes cart */
  async confirmCartAndCreateOrderChunk(
    sessionId: string,
    txInput?: Prisma.TransactionClient,
  ) {
    const method = this.confirmCartAndCreateOrderChunk.name;
    this.logger.log(`[${method}] Confirming cart for session ${sessionId}`);
    // Use provided tx or start a new one if called standalone
    const transactionLogic = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch Cart with items/options/menuItemPrice
      const cart = await tx.cart.findUnique({
        where: { activeTableSessionId: sessionId },
        select: {
          // Select only needed fields
          id: true,
          activeTableSessionId: true,
          items: {
            where: { menuItemId: { not: null } }, // Only valid items
            select: {
              id: true,
              menuItemId: true,
              quantity: true,
              notes: true,
              menuItem: { select: { basePrice: true } },
              selectedOptions: { select: { id: true, additionalPrice: true } },
            },
          },
        },
      });
      if (!cart)
        throw new NotFoundException(`Cart not found for session ${sessionId}.`);
      if (!cart.items || cart.items.length === 0)
        throw new BadRequestException('Cannot confirm an empty cart.');

      // 2. Find or Create ActiveOrder
      let activeOrder = await tx.activeOrder.findUnique({
        where: { activeTableSessionId: sessionId },
        select: { id: true },
      });
      if (!activeOrder) {
        activeOrder = await tx.activeOrder.create({
          data: { activeTableSessionId: sessionId },
          select: { id: true },
        });
        this.logger.log(
          `[${method}] Created ActiveOrder ${activeOrder.id} for session ${sessionId}.`,
        );
      }

      // 3. Prepare Chunk Item Data
      const chunkItemsData: Prisma.ActiveOrderChunkItemCreateWithoutActiveOrderChunkInput[] =
        cart.items.map((cartItem) => {
          if (!cartItem.menuItem)
            throw new InternalServerErrorException(
              `Data inconsistency: MenuItem null for CartItem ${cartItem.id}`,
            ); // Should be filtered by query
          const _basePrice = cartItem.menuItem.basePrice ?? new Decimal(0);
          let optionsTotal = new Decimal(0);
          cartItem.selectedOptions.forEach((opt) => {
            optionsTotal = optionsTotal.plus(opt.additionalPrice ?? 0);
          });
          // finalPrice is NOT stored on ActiveOrderChunkItem anymore
          return {
            menuItemId: cartItem.menuItemId,
            quantity: cartItem.quantity,
            notes: cartItem.notes,
            status: PreparationStatus.PENDING,
            selectedOptions: {
              connect: cartItem.selectedOptions.map((opt) => ({ id: opt.id })),
            },
          };
        });

      // 4. Create ActiveOrderChunk with items
      const newChunk = await tx.activeOrderChunk.create({
        data: {
          activeOrderId: activeOrder.id,
          chunkItems: { create: chunkItemsData },
        },
        include: {
          // Include details for return/emission
          chunkItems: {
            include: {
              menuItem: { select: { id: true, name: true, imageUrl: true } },
              selectedOptions: {
                select: { id: true, name: true, additionalPrice: true },
              },
            },
          },
        },
      });
      this.logger.log(
        `[${method}] Created ActiveOrderChunk ${newChunk.id} with ${newChunk.chunkItems.length} items.`,
      );

      // 5. Delete Cart
      await tx.cart.delete({ where: { id: cart.id } });
      this.logger.log(`[${method}] Cart ${cart.id} deleted.`);

      // 6. Return created chunk
      return newChunk;
    };

    // Execute in transaction
    try {
      if (txInput) {
        return await transactionLogic(txInput); // Use existing transaction
      } else {
        return await this.prisma.$transaction(transactionLogic); // Start new transaction
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `[${method}] Failed to confirm cart for session ${sessionId}: ${err.message}`,
        err.stack,
      );
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new InternalServerErrorException('Could not confirm cart.');
    }
  } // End confirmCartAndCreateOrderChunk
}
