import { RequestWithUser } from 'src/auth/types';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { MenuItemDeletedResponseDto } from 'src/menu/dto/menu-item-deleted-response.dto';
import { MenuItemResponseDto } from 'src/menu/dto/menu-item-response.dto';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MenuItem as MenuItemModel } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuService } from './menu.service';

@ApiTags('Menu')
@Controller('menu-items')
@ApiExtraModels(
  MenuItemDeletedResponseDto,
  MenuItemResponseDto,
  MenuItemResponseDto,
  StandardApiErrorDetails,
  StandardApiResponse,
)
export class MenuController {
  private readonly logger = new Logger(MenuController.name);

  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: 'Get all menu items for a specific store (Public)' })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: String,
    format: 'uuid',
    description: 'ID (UUID) of the store whose menu items to fetch',
    example: '018ebc9a-7e1c-7f5e-b48a-3f4f72c55a1e',
  })
  @ApiSuccessResponse(MenuItemResponseDto, {
    isArray: true,
    description: 'List of menu items retrieved successfully.',
  })
  async getStoreMenuItems(
    @Query('storeId', new ParseUUIDPipe({ version: '7' })) storeId: string,
  ): Promise<StandardApiResponse<MenuItemModel[]>> {
    const method = this.getStoreMenuItems.name;
    this.logger.log(`[${method}] Fetching menu items for Store ${storeId}`);
    const items = await this.menuService.getStoreMenuItems(storeId);

    return StandardApiResponse.success(
      items,
      'Menu items retrieved successfully',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single menu item by ID (Public)' })
  @ApiSuccessResponse(
    MenuItemResponseDto,
    'Menu item details retrieved successfully.',
  )
  async getMenuItemById(
    @Param('id', new ParseUUIDPipe({ version: '7' })) itemId: string,
  ): Promise<StandardApiResponse<MenuItemModel>> {
    const method = this.getMenuItemById.name;
    this.logger.log(`[${method}] Fetching menu item by ID ${itemId}`);
    const item = await this.menuService.getMenuItemById(itemId);
    return StandardApiResponse.success(
      item,
      'Menu item retrieved successfully',
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a menu item (OWNER or ADMIN)' })
  @ApiSuccessResponse(String, {
    status: HttpStatus.CREATED,
    description: 'Menu item created successfully.',
  })
  async createMenuItem(
    @Req() req: RequestWithUser,
    @Query('storeId', new ParseUUIDPipe({ version: '7' })) storeId: string,
    @Body() dto: CreateMenuItemDto,
  ): Promise<StandardApiResponse<MenuItemModel>> {
    const method = this.createMenuItem.name;
    const userId = req.user.sub;

    this.logger.log(
      `[${method}] User ${userId} creating menu item in Store ${storeId}`,
    );
    const newItem = await this.menuService.createMenuItem(userId, storeId, dto);
    return StandardApiResponse.success(
      newItem,
      'Menu item created successfully',
    );
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu item (OWNER or ADMIN)' })
  @ApiSuccessResponse(MenuItemResponseDto, {
    description: 'Menu item updated successfully.',
  })
  async updateMenuItem(
    @Req() req: RequestWithUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) itemId: string,
    @Query('storeId', new ParseUUIDPipe({ version: '7' })) storeId: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<StandardApiResponse<MenuItemModel>> {
    const method = this.updateMenuItem.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} updating menu item ${itemId} in Store ${storeId}`,
    );
    const updatedItem = await this.menuService.updateMenuItem(
      userId,
      storeId,
      itemId,
      dto,
    );
    return StandardApiResponse.success(
      updatedItem,
      'Menu item updated successfully',
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a menu item (OWNER or ADMIN)' })
  @ApiSuccessResponse(
    MenuItemDeletedResponseDto,
    'Menu item deleted successfully.',
  )
  async deleteMenuItem(
    @Req() req: RequestWithUser,
    @Param('id', new ParseUUIDPipe({ version: '7' })) itemId: string,
    @Query('storeId', new ParseUUIDPipe({ version: '7' })) storeId: string,
  ): Promise<StandardApiResponse<unknown>> {
    const method = this.deleteMenuItem.name;
    const userId = req.user.sub;
    this.logger.log(
      `[${method}] User ${userId} deleting menu item ${itemId} from Store ${storeId}`,
    );
    const deletedResult = await this.menuService.deleteMenuItem(
      userId,
      storeId,
      itemId,
    );
    return StandardApiResponse.success(
      deletedResult,
      'Menu item deleted successfully',
    );
  }
}
