import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { RequestWithUser } from 'src/auth/types';
import { Category } from '@prisma/client';
import { StoreId } from 'src/common/decorators/store-id.decorator';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized.' })
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Category created successfully.',
    type: StandardApiResponse<Category>,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission (Owner/Admin required).',
  })
  async create(
    @Req() req: RequestWithUser,
    @StoreId() storeId: number,
    @Body() dto: CreateCategoryDto,
  ): Promise<StandardApiResponse<Category>> {
    const userId = req.user.sub;
    const method = this.create.name;
    this.logger.log(
      `[${method}] User ${userId} creating category in Store ${storeId}. Name: ${dto.name}`,
    );
    const category = await this.categoryService.create(userId, storeId, dto);
    return StandardApiResponse.success(
      category,
      'Category created successfully.',
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories for the store' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categories retrieved successfully.',
    type: StandardApiResponse<Category[]>,
  })
  async findAll(
    @Req() req: RequestWithUser,
    @StoreId() storeId: number,
  ): Promise<StandardApiResponse<Category[]>> {
    const userId = req.user.sub;
    const method = this.findAll.name;

    const includeItems = false;

    this.logger.log(
      `[${method}] User ${userId} fetching categories for Store ${storeId}, includeItems: ${includeItems}`,
    );
    const categories = await this.categoryService.findAll(
      storeId,
      includeItems,
    );
    return StandardApiResponse.success(
      categories,
      'Categories retrieved successfully.',
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific category by ID' })
  @ApiParam({ name: 'id', description: 'ID of the category to retrieve' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category retrieved successfully.',
    type: StandardApiResponse<Category>,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
  })
  async findOne(
    @StoreId() storeId: number,
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<StandardApiResponse<Category>> {
    const method = this.findOne.name;
    this.logger.log(
      `[${method}] Fetching category ID ${categoryId} within Store ${storeId} context.`,
    );
    const category = await this.categoryService.findOne(categoryId, storeId);
    return StandardApiResponse.success(
      category,
      'Category retrieved successfully.',
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category name' })
  @ApiParam({ name: 'id', description: 'ID of the category to update' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category updated successfully.',
    type: StandardApiResponse<Category>,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission (Owner/Admin required).',
  })
  async update(
    @Req() req: RequestWithUser,
    @StoreId() storeId: number,
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<StandardApiResponse<Category>> {
    const userId = req.user.sub;
    const method = this.update.name;
    this.logger.log(
      `[${method}] User ${userId} updating category ID ${categoryId} in Store ${storeId}.`,
    );
    const updatedCategory = await this.categoryService.update(
      userId,
      storeId,
      categoryId,
      dto,
    );
    return StandardApiResponse.success(
      updatedCategory,
      'Category updated successfully.',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'ID of the category to delete' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category deleted successfully.',
    type: StandardApiResponse<{ id: number }>,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission (Owner/Admin required).',
  })
  async remove(
    @Req() req: RequestWithUser,
    @StoreId() storeId: number,
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<StandardApiResponse<{ id: number }>> {
    const userId = req.user.sub;
    const method = this.remove.name;
    this.logger.log(
      `[${method}] User ${userId} deleting category ID ${categoryId} from Store ${storeId}.`,
    );
    const deletedResult = await this.categoryService.remove(
      userId,
      storeId,
      categoryId,
    );
    return StandardApiResponse.success(
      deletedResult,
      'Category deleted successfully.',
    );
  }

  @Patch('sort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder categories and their menu items' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categories and items reordered successfully.',
    type: StandardApiResponse<null>,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid payload data (e.g., mismatched IDs).',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User lacks permission (Owner/Admin required).',
  })
  async sortCategories(
    @Req() req: RequestWithUser,
    @StoreId() storeId: number,
    @Body() payload: SortCategoriesPayloadDto,
  ): Promise<StandardApiResponse<null>> {
    const userId = req.user.sub;
    const method = this.sortCategories.name;
    this.logger.log(
      `[${method}] User ${userId} sorting categories/items in Store ${storeId}.`,
    );
    const result = await this.categoryService.sortCategoriesAndMenuItems(
      userId,
      storeId,
      payload,
    );

    return StandardApiResponse.success(null, result.message);
  }
}
