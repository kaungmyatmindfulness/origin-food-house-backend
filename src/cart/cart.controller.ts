import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { SessionContext } from 'src/auth/customer-session-jwt.strategy';
import { CustomerSessionJwtAuthGuard } from 'src/auth/guards/customer-session-jwt.guard';
import { CartService } from 'src/cart/cart.service';
import { AddItemToCartDto } from 'src/cart/dto/add-item-to-cart.dto';
import { CartItemResponseDto } from 'src/cart/dto/cart-item-response.dto';
import { CartResponseDto } from 'src/cart/dto/cart-response.dto';
import { UpdateCartItemDto } from 'src/cart/dto/update-cart-item.dto';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { CustomizationOptionResponseDto } from 'src/menu/dto/customization-option-response.dto';
import { MenuItemBasicResponseDto } from 'src/menu/dto/menu-item-basic-response.dto';

function getSessionCtx(req: Request): SessionContext {
  const ctx = req.user as SessionContext;
  if (!ctx?.sessionId) {
    throw new UnauthorizedException('Session context not found.');
  }
  return ctx;
}

@ApiTags('Cart (Customer Session)')
@ApiCookieAuth('session_token')
@UseGuards(CustomerSessionJwtAuthGuard)
@Controller('sessions/my-cart')
@ApiUnauthorizedResponse({
  description: 'Missing, invalid, or expired session cookie.',
  type: StandardApiResponse,
})
@ApiExtraModels(
  StandardApiResponse,
  StandardApiErrorDetails,
  CartResponseDto,
  CartItemResponseDto,
  MenuItemBasicResponseDto,
  CustomizationOptionResponseDto,
)
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private readonly cartService: CartService) {}

  /**
   * Get the current session's cart contents.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get the current session's cart" })
  @ApiSuccessResponse(CartResponseDto, 'Cart retrieved successfully.')
  @ApiNotFoundResponse({
    description: 'Cart or session not found.',
    type: StandardApiResponse,
  })
  async getMyCart(
    @Req() req: Request,
  ): Promise<StandardApiResponse<CartResponseDto | null>> {
    const sessionCtx = getSessionCtx(req);
    this.logger.log(`Fetching cart for session ${sessionCtx.sessionId}`);
    const cart = await this.cartService.getCart(sessionCtx.sessionId);

    return StandardApiResponse.success(
      cart as CartResponseDto,
      'Cart retrieved successfully.',
    );
  }

  /**
   * Add an item to the current session's cart.
   */
  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add an item to the cart' })
  @ApiBody({ type: AddItemToCartDto })
  @ApiSuccessResponse(
    CartResponseDto,
    'Item added successfully. Returns updated cart.',
  )
  @ApiBadRequestResponse({
    description: 'Invalid item data (e.g., bad menu item ID, invalid options).',
    type: StandardApiResponse,
  })
  @ApiNotFoundResponse({
    description: 'Session or Menu Item not found.',
    type: StandardApiResponse,
  })
  async addItem(
    @Req() req: Request,
    @Body() dto: AddItemToCartDto,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const sessionCtx = getSessionCtx(req);
    this.logger.log(
      `Adding item ${dto.menuItemId} to cart for session ${sessionCtx.sessionId}`,
    );
    const updatedCart = await this.cartService.addItemToCart(
      sessionCtx.sessionId,
      dto,
    );

    return StandardApiResponse.success(
      updatedCart as CartResponseDto,
      'Item added to cart successfully.',
    );
  }

  /**
   * Update an item's quantity or notes in the current session's cart.
   */
  @Patch('items/:cartItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update quantity or notes for a cart item' })
  @ApiParam({
    name: 'cartItemId',
    type: String,
    format: 'uuid',
    description: 'ID of the CartItem to update',
  })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiSuccessResponse(
    CartResponseDto,
    'Cart item updated successfully. Returns updated cart.',
  )
  @ApiBadRequestResponse({
    description: 'Invalid input (e.g., quantity < 1).',
    type: StandardApiResponse,
  })
  @ApiNotFoundResponse({
    description: 'Session or Cart Item not found.',
    type: StandardApiResponse,
  })
  async updateItem(
    @Req() req: Request,
    @Param('cartItemId', ParseUUIDPipe) cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const sessionCtx = getSessionCtx(req);
    this.logger.log(
      `Updating item ${cartItemId} in cart for session ${sessionCtx.sessionId}`,
    );

    const updatedCart = await this.cartService.updateCartItem(
      sessionCtx.sessionId,
      cartItemId,
      {
        quantity: dto.quantity,
        notes: dto.notes,
      },
    );

    return StandardApiResponse.success(
      updatedCart as CartResponseDto,
      'Cart item updated successfully.',
    );
  }

  /**
   * Remove an item from the current session's cart.
   */
  @Delete('items/:cartItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiParam({
    name: 'cartItemId',
    type: String,
    format: 'uuid',
    description: 'ID of the CartItem to remove',
  })
  @ApiSuccessResponse(
    CartResponseDto,
    'Item removed successfully. Returns updated cart.',
  )
  @ApiNotFoundResponse({
    description: 'Session or Cart Item not found.',
    type: StandardApiResponse,
  })
  async removeItem(
    @Req() req: Request,
    @Param('cartItemId', ParseUUIDPipe) cartItemId: string,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const sessionCtx = getSessionCtx(req);
    this.logger.log(
      `Removing item ${cartItemId} from cart for session ${sessionCtx.sessionId}`,
    );
    const updatedCart = await this.cartService.removeItemFromCart(
      sessionCtx.sessionId,
      cartItemId,
    );

    return StandardApiResponse.success(
      updatedCart as CartResponseDto,
      'Item removed from cart successfully.',
    );
  }

  /**
   * Clear all items from the current session's cart.
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all items from the cart' })
  @ApiSuccessResponse(
    CartResponseDto,
    'Cart cleared successfully. Returns empty cart.',
  )
  @ApiNotFoundResponse({
    description: 'Session or Cart not found.',
    type: StandardApiResponse,
  })
  async clearCart(
    @Req() req: Request,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const sessionCtx = getSessionCtx(req);
    this.logger.log(`Clearing cart for session ${sessionCtx.sessionId}`);
    const updatedCart = await this.cartService.clearCart(sessionCtx.sessionId);

    return StandardApiResponse.success(
      updatedCart as CartResponseDto,
      'Cart cleared successfully.',
    );
  }
}
