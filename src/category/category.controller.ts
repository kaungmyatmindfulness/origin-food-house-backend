import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req, // Keep Req only if needed for userId (sub)
  ParseIntPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { RequestWithUser } from 'src/auth/types';
import { Category } from '@prisma/client';
import { StoreId } from 'src/common/decorators/store-id.decorator'; // Import the decorator

@ApiTags('category')
@Controller('category')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
// ... global ApiResponses ...
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  // REMOVED: private getStoreIdFromRequest(req: RequestWithUser): number { ... }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // ... Api decorators ...
  async create(
    @Req() req: RequestWithUser, // Still need req for userId (sub)
    @StoreId() storeId: number, // Use the decorator to get storeId
    @Body() dto: CreateCategoryDto,
  ): Promise<BaseApiResponse<Category>> {
    const userId = req.user.sub;
    // storeId is now validated and injected by the @StoreId() decorator
    this.logger.log(
      `User ${userId} creating category in Store ${storeId}. Name: ${dto.name}`,
    );
    const category = await this.categoryService.create(userId, storeId, dto);
    return BaseApiResponse.success(category, 'Category created successfully.');
  }

  @Get()
  // ... Api decorators ...
  async findAll(
    @Req() req: RequestWithUser, // Still need req for userId (sub) if logging/auditing
    @StoreId() storeId: number, // Use the decorator
  ): Promise<BaseApiResponse<Category[]>> {
    const includeItems = false;
    this.logger.verbose(
      `User ${req.user.sub} fetching categories for Store ${storeId}`,
    );
    const categories = await this.categoryService.findAll(
      storeId,
      includeItems,
    );
    return BaseApiResponse.success(
      categories,
      'Categories retrieved successfully.',
    );
  }

  @Get(':id')
  // ... Api decorators ...
  async findOne(
    // Removed Req as userId isn't strictly needed just to view within the store context
    @StoreId() storeId: number, // Use decorator to ensure store context exists
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<BaseApiResponse<Category>> {
    this.logger.verbose(
      `Workspaceing category ID ${categoryId} within Store ${storeId} context.`,
    );
    const category = await this.categoryService.findOne(categoryId, storeId);
    return BaseApiResponse.success(
      category,
      'Category retrieved successfully.',
    );
  }

  @Patch(':id')
  // ... Api decorators ...
  async update(
    @Req() req: RequestWithUser, // Need req for userId (sub)
    @StoreId() storeId: number, // Use decorator
    @Param('id', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<BaseApiResponse<Category>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} updating category ID ${categoryId} in Store ${storeId}.`,
    );
    const updatedCategory = await this.categoryService.update(
      userId,
      storeId,
      categoryId,
      dto,
    );
    return BaseApiResponse.success(
      updatedCategory,
      'Category updated successfully.',
    );
  }

  @Delete(':id')
  // ... Api decorators ...
  async remove(
    @Req() req: RequestWithUser, // Need req for userId (sub)
    @StoreId() storeId: number, // Use decorator
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<BaseApiResponse<{ id: number }>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} deleting category ID ${categoryId} from Store ${storeId}.`,
    );
    const deletedResult = await this.categoryService.remove(
      userId,
      storeId,
      categoryId,
    );
    return BaseApiResponse.success(
      deletedResult,
      'Category deleted successfully.',
    );
  }

  @Patch('sort')
  // ... Api decorators ...
  async sortCategories(
    @Req() req: RequestWithUser, // Need req for userId (sub)
    @StoreId() storeId: number, // Use decorator
    @Body() payload: SortCategoriesPayloadDto,
  ): Promise<BaseApiResponse<null>> {
    const userId = req.user.sub;
    this.logger.log(
      `User ${userId} sorting categories/items in Store ${storeId}.`,
    );
    const result = await this.categoryService.sortCategoriesAndMenuItems(
      userId,
      storeId,
      payload,
    );
    return BaseApiResponse.success(null, result.message);
  }
}
