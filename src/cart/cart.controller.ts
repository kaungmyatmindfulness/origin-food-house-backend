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
import { ApiTags, ApiOperation, ApiQuery, ApiHeader } from "@nestjs/swagger";

import { CartService } from "./cart.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { CartResponseDto } from "./dto/cart-response.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { RequestWithUser } from "../auth/types";
import {
  ApiResourceErrors,
  ApiUuidParam,
} from "../common/decorators/api-crud.decorator";
import { ApiSuccessResponse } from "../common/decorators/api-success-response.decorator";
import { StandardApiResponse } from "../common/dto/standard-api-response.dto";

const SESSION_HEADER = {
  name: "x-session-token",
  description: "Session token for customer access (SOS app)",
  required: false,
};

@ApiTags("Cart")
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get current cart for session" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiHeader(SESSION_HEADER)
  @ApiSuccessResponse(CartResponseDto, "Cart retrieved successfully")
  @ApiResourceErrors()
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
  @ApiHeader(SESSION_HEADER)
  @ApiSuccessResponse(CartResponseDto, {
    status: HttpStatus.CREATED,
    description: "Item added to cart successfully",
  })
  @ApiResourceErrors()
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
  @ApiUuidParam("cartItemId", "Cart item ID")
  @ApiHeader(SESSION_HEADER)
  @ApiSuccessResponse(CartResponseDto, "Cart item updated successfully")
  @ApiResourceErrors()
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
  @ApiOperation({ summary: "Remove item from cart" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiUuidParam("cartItemId", "Cart item ID")
  @ApiHeader(SESSION_HEADER)
  @ApiSuccessResponse(CartResponseDto, "Item removed from cart successfully")
  @ApiResourceErrors()
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
  @ApiOperation({ summary: "Clear all items from cart" })
  @ApiQuery({ name: "sessionId", description: "Active table session ID" })
  @ApiHeader(SESSION_HEADER)
  @ApiSuccessResponse(CartResponseDto, "Cart cleared successfully")
  @ApiResourceErrors()
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
