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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';

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
  async getStoreMenuItems(
    @Query('storeId', ParseIntPipe) storeId: number,
  ): Promise<BaseApiResponse<unknown>> {
    const items = await this.menuService.getStoreMenuItems(storeId);
    return {
      status: 'success',
      data: items,
      message: null,
      error: null,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single menu item by ID (public read)' })
  async getMenuItemById(
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<BaseApiResponse<unknown>> {
    const item = await this.menuService.getMenuItemById(itemId);
    return {
      status: 'success',
      data: item,
      message: null,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a menu item (OWNER or ADMIN)' })
  async createMenuItem(
    @Req() req: RequestWithUser,
    @Body() dto: CreateMenuItemDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const storeId = req.user.storeId;
    const newItem = await this.menuService.createMenuItem(userId, storeId, dto);
    return {
      status: 'success',
      data: newItem,
      message: 'Menu item created successfully',
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a menu item (OWNER or ADMIN)' })
  async updateMenuItem(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) itemId: number,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const storeId = req.user.storeId;
    const updated = await this.menuService.updateMenuItem(
      userId,
      storeId,
      itemId,
      dto,
    );
    return {
      status: 'success',
      data: updated,
      message: 'Menu item updated successfully',
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a menu item (OWNER or ADMIN)' })
  async deleteMenuItem(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) itemId: number,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const storeId = req.user.storeId;
    const deleted = await this.menuService.deleteMenuItem(
      userId,
      storeId,
      itemId,
    );
    return {
      status: 'success',
      data: deleted,
      message: 'Menu item deleted successfully',
      error: null,
    };
  }
}
