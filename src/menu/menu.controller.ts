import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode, // Import HttpCode decorator
  HttpStatus, // Import HttpStatus enum
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse, // Import ApiResponse
} from '@nestjs/swagger';
import { MenuService } from './menu.service';
// ** Import NEW DTOs **
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MenuItem } from '@prisma/client'; // Import Prisma model for response typing
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types';

@ApiTags('menu')
@Controller('menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: 'Get all menu items for a store (public read)' })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: Number,
    description: 'ID of the store',
  })
  @ApiResponse({
    status: 200,
    description: 'List of menu items retrieved successfully.',
    type: BaseApiResponse,
  }) // Add type if possible
  async getStoreMenuItems(
    @Query('storeId', ParseIntPipe) storeId: number,
  ): Promise<BaseApiResponse<MenuItem[]>> {
    // Use specific type
    const items = await this.menuService.getStoreMenuItems(storeId);
    return new BaseApiResponse<MenuItem[]>(
      items,
      'Menu items retrieved successfully',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single menu item by ID (public read)' })
  @ApiResponse({
    status: 200,
    description: 'Menu item details retrieved successfully.',
    type: BaseApiResponse,
  }) // Add type if possible
  @ApiResponse({ status: 404, description: 'Menu item not found.' })
  async getMenuItemById(
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<BaseApiResponse<MenuItem>> {
    // Use specific type
    const item = await this.menuService.getMenuItemById(itemId);
    return new BaseApiResponse<MenuItem>(
      item,
      'Menu item retrieved successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @HttpCode(HttpStatus.CREATED) // Set correct HTTP status code for creation
  @ApiOperation({ summary: 'Create a menu item (OWNER or ADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Menu item created successfully.',
    type: BaseApiResponse,
  }) // Add type if possible
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 403, description: 'Forbidden resource.' })
  async createMenuItem(
    @Req() req: RequestWithUser,
    @Body() dto: CreateMenuItemDto, // ** Use NEW DTO **
  ): Promise<BaseApiResponse<MenuItem>> {
    // Use specific type
    const userId = req.user.sub;
    // Assuming storeId is correctly attached to req.user by a previous middleware/guard
    const storeId = req.user.storeId;
    if (!storeId) {
      // Handle case where storeId might not be on user context yet
      throw new Error('Store ID not found on user request context.'); // Or handle more gracefully
    }
    const newItem = await this.menuService.createMenuItem(userId, storeId, dto);
    return new BaseApiResponse<MenuItem>(
      newItem,
      'Menu item created successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a menu item (OWNER or ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Menu item updated successfully.',
    type: BaseApiResponse,
  }) // Add type if possible
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 403, description: 'Forbidden resource.' })
  @ApiResponse({ status: 404, description: 'Menu item not found.' })
  async updateMenuItem(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: UpdateMenuItemDto, // ** Use NEW DTO **
  ): Promise<BaseApiResponse<MenuItem>> {
    // Use specific type
    const userId = req.user.sub;
    const storeId = req.user.storeId;
    if (!storeId) {
      throw new Error('Store ID not found on user request context.');
    }
    const updatedItem = await this.menuService.updateMenuItem(
      userId,
      storeId,
      itemId,
      dto,
    );
    return new BaseApiResponse<MenuItem>(
      updatedItem,
      'Menu item updated successfully',
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK) // Or 204 No Content if you don't return data
  @ApiOperation({ summary: 'Delete a menu item (OWNER or ADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Menu item deleted successfully.',
    type: BaseApiResponse,
  }) // Use type { id: number }
  @ApiResponse({ status: 403, description: 'Forbidden resource.' })
  @ApiResponse({ status: 404, description: 'Menu item not found.' })
  async deleteMenuItem(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<BaseApiResponse<{ id: number }>> {
    // Return type indicates deleted ID
    const userId = req.user.sub;
    const storeId = req.user.storeId;
    if (!storeId) {
      throw new Error('Store ID not found on user request context.');
    }
    const deletedResult = await this.menuService.deleteMenuItem(
      userId,
      storeId,
      itemId,
    );
    return new BaseApiResponse<{ id: number }>(
      deletedResult,
      'Menu item deleted successfully',
    );
  }
}
