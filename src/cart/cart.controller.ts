import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from "@nestjs/swagger";

import { CartService } from "./cart.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { CartResponseDto } from "./dto/cart-response.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { RequestWithUser } from "../auth/types";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

@ApiTags("Cart")
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get current cart for session" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiHeader({
    name: "x-session-token",
    description: "Session token for customer access (SOS app)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Cart retrieved successfully",
    type: CartResponseDto,
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Session not found" })
  async getCart(
    @Query("sessionId") sessionId: string,
    @Headers("x-session-token") sessionToken?: string,
    @Req() req?: RequestWithUser,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const userId = req?.user?.sub;
    const cart = await this.cartService.getCart(
      sessionId,
      sessionToken,
      userId,
    );
    return StandardApiResponse.success(cart);
  }

  @Post("items")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Add item to cart" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiHeader({
    name: "x-session-token",
    description: "Session token for customer access (SOS app)",
    required: false,
  })
  @ApiResponse({
    status: 201,
    description: "Item added to cart successfully",
    type: CartResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Menu item or session not found" })
  async addItem(
    @Query("sessionId") sessionId: string,
    @Body() dto: AddToCartDto,
    @Headers("x-session-token") sessionToken?: string,
    @Req() req?: RequestWithUser,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const userId = req?.user?.sub;
    const cart = await this.cartService.addItem(
      sessionId,
      dto,
      sessionToken,
      userId,
    );
    return StandardApiResponse.success(cart);
  }

  @Patch("items/:cartItemId")
  @ApiOperation({ summary: "Update cart item" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiParam({ name: "cartItemId", description: "Cart item ID" })
  @ApiHeader({
    name: "x-session-token",
    description: "Session token for customer access (SOS app)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Cart item updated successfully",
    type: CartResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input" })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Cart item not found" })
  async updateItem(
    @Query("sessionId") sessionId: string,
    @Param("cartItemId") cartItemId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers("x-session-token") sessionToken?: string,
    @Req() req?: RequestWithUser,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const userId = req?.user?.sub;
    const cart = await this.cartService.updateItem(
      sessionId,
      cartItemId,
      dto,
      sessionToken,
      userId,
    );
    return StandardApiResponse.success(cart);
  }

  @Delete("items/:cartItemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove item from cart" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiParam({ name: "cartItemId", description: "Cart item ID" })
  @ApiHeader({
    name: "x-session-token",
    description: "Session token for customer access (SOS app)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Item removed from cart successfully",
    type: CartResponseDto,
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Cart item not found" })
  async removeItem(
    @Query("sessionId") sessionId: string,
    @Param("cartItemId") cartItemId: string,
    @Headers("x-session-token") sessionToken?: string,
    @Req() req?: RequestWithUser,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const userId = req?.user?.sub;
    const cart = await this.cartService.removeItem(
      sessionId,
      cartItemId,
      sessionToken,
      userId,
    );
    return StandardApiResponse.success(cart);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Clear all items from cart" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiHeader({
    name: "x-session-token",
    description: "Session token for customer access (SOS app)",
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Cart cleared successfully",
    type: CartResponseDto,
  })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Access denied" })
  @ApiResponse({ status: 404, description: "Cart not found" })
  async clearCart(
    @Query("sessionId") sessionId: string,
    @Headers("x-session-token") sessionToken?: string,
    @Req() req?: RequestWithUser,
  ): Promise<StandardApiResponse<CartResponseDto>> {
    const userId = req?.user?.sub;
    const cart = await this.cartService.clearCart(
      sessionId,
      sessionToken,
      userId,
    );
    return StandardApiResponse.success(cart);
  }
}
