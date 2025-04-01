import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RequestWithUser } from 'src/auth/types/expressRequest.interface';
import { SortCategoriesPayloadDto } from 'src/category/dto/sort-categories-payload.dto';

@ApiTags('category')
@Controller('category')
@UseGuards(JwtAuthGuard) // all routes require JWT
@ApiBearerAuth()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * Create a new category
   */
  @Post()
  @ApiOperation({ summary: 'Create a new category (OWNER or ADMIN only)' })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    schema: {
      example: {
        status: 'success',
        data: {
          id: 10,
          name: 'Main Dishes',
          storeId: 3,
          createdAt: '2025-03-25T12:00:00.000Z',
          updatedAt: '2025-03-25T12:00:00.000Z',
        },
        message: 'Category created',
        error: null,
      },
    },
  })
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateCategoryDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const storeId = req.user.storeId; // from the JWT
    const category = await this.categoryService.create(userId, storeId, dto);
    return {
      status: 'success',
      data: category,
      message: 'Category created',
      error: null,
    };
  }

  /**
   * Get all categories for the user's current store
   */
  @Get()
  @ApiOperation({ summary: 'Get categories for the current store' })
  async findAll(
    @Req() req: RequestWithUser,
  ): Promise<BaseApiResponse<unknown>> {
    const storeId = req.user.storeId;
    // if you want to also check role, you can,
    // but read-only might be allowed for all roles
    const categories = await this.categoryService.findAll(storeId);
    return {
      status: 'success',
      data: categories,
      message: null,
      error: null,
    };
  }

  /**
   * Get a single category by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID in the current store' })
  async findOne(
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<BaseApiResponse<unknown>> {
    // Possibly no store check if read is public
    // or you can do a store check
    const category = await this.categoryService.findOne(categoryId);
    return {
      status: 'success',
      data: category,
      message: null,
      error: null,
    };
  }

  /**
   * Update a category by ID
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a category (OWNER or ADMIN only)' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const storeId = req.user.storeId;
    const updated = await this.categoryService.update(
      userId,
      storeId,
      categoryId,
      dto,
    );
    return {
      status: 'success',
      data: updated,
      message: 'Category updated',
      error: null,
    };
  }

  /**
   * Delete a category by ID
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category (OWNER or ADMIN only)' })
  async remove(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<BaseApiResponse<unknown>> {
    const userId = req.user.id;
    const storeId = req.user.storeId;
    const deleted = await this.categoryService.remove(
      userId,
      storeId,
      categoryId,
    );
    return {
      status: 'success',
      data: deleted,
      message: 'Category deleted',
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('sort')
  @ApiOperation({ summary: 'Update sort order for categories + menu items' })
  @ApiResponse({
    status: 200,
    description: 'Successfully updated sort orders',
    schema: {
      example: {
        status: 'success',
        data: null,
        message: 'Categories & menu items reordered successfully',
        error: null,
      },
    },
  })
  async sortCategories(
    @Req() req: RequestWithUser,
    @Body() payload: SortCategoriesPayloadDto,
  ): Promise<BaseApiResponse<null>> {
    const userId = req.user.id;
    const storeId = req.user.storeId;

    const result = await this.categoryService.sortCategoriesAndMenuItems(
      userId,
      storeId,
      payload,
    );
    return {
      status: 'success',
      data: null,
      message: result.message,
      error: null,
    };
  }
}
