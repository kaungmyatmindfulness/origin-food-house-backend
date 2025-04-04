import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req, // Keep for userId extraction
  ParseIntPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation, // For better Swagger descriptions
  ApiResponse, // For specific response types
  ApiParam, // For parameter descriptions
} from '@nestjs/swagger';

import { BaseApiResponse } from 'src/common/dto/base-api-response.dto';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { RequestWithUser } from 'src/auth/types';
import { Category } from '@prisma/client';
import { StoreId } from 'src/common/decorators/store-id.decorator';

@ApiTags('Categories') // Plural tag is common
@ApiBearerAuth() // Indicates JWT is required for all routes in this controller
@UseGuards(JwtAuthGuard) // Apply JWT guard to all routes
@Controller('category') // Route prefix
// Add common API responses if applicable (e.g., 401 Unauthorized)
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
    type: BaseApiResponse<Category>, // Define specific response type
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
    @StoreId() storeId: number, // Use custom decorator
    @Body() dto: CreateCategoryDto,
  ): Promise<BaseApiResponse<Category>> {
    const userId = req.user.sub;
    const method = this.create.name; // For logging context
    this.logger.log(
      `[${method}] User ${userId} creating category in Store ${storeId}. Name: ${dto.name}`,
    );
    const category = await this.categoryService.create(userId, storeId, dto);
    return BaseApiResponse.success(category, 'Category created successfully.');
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories for the store' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categories retrieved successfully.',
    type: BaseApiResponse<Category[]>, // Type for array response
  })
  async findAll(
    @Req() req: RequestWithUser, // Keep req for logging user context
    @StoreId() storeId: number,
    // Optional: Add query param if needed in future
    // @Query('includeItems') includeItems?: boolean
  ): Promise<BaseApiResponse<Category[]>> {
    const userId = req.user.sub;
    const method = this.findAll.name;
    // Simplified: includeItems is false unless explicitly requested via query
    const includeItems = false; // Hardcoded for now, modify if query param is added

    this.logger.log(
      `[${method}] User ${userId} fetching categories for Store ${storeId}, includeItems: ${includeItems}`,
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
  @ApiOperation({ summary: 'Get a specific category by ID' })
  @ApiParam({ name: 'id', description: 'ID of the category to retrieve' }) // Describe path param
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category retrieved successfully.',
    type: BaseApiResponse<Category>,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found in this store.',
  })
  async findOne(
    @StoreId() storeId: number, // Ensures store context validity
    @Param('id', ParseIntPipe) categoryId: number,
    // Removed @Req() as userId not strictly needed for this operation's logic
  ): Promise<BaseApiResponse<Category>> {
    const method = this.findOne.name;
    this.logger.log(
      `[${method}] Fetching category ID ${categoryId} within Store ${storeId} context.`,
    );
    const category = await this.categoryService.findOne(categoryId, storeId);
    return BaseApiResponse.success(
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
    type: BaseApiResponse<Category>,
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
  ): Promise<BaseApiResponse<Category>> {
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
    return BaseApiResponse.success(
      updatedCategory,
      'Category updated successfully.',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK) // Or 204 No Content, but OK with response is fine
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'ID of the category to delete' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category deleted successfully.',
    type: BaseApiResponse<{ id: number }>,
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
  ): Promise<BaseApiResponse<{ id: number }>> {
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
    return BaseApiResponse.success(
      deletedResult,
      'Category deleted successfully.',
    );
  }

  @Patch('sort') // Use PATCH for reordering operation
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder categories and their menu items' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categories and items reordered successfully.',
    type: BaseApiResponse<null>, // Explicitly show data is null
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
  ): Promise<BaseApiResponse<null>> {
    // Return type indicates null data
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
    // Return null for data field, message comes from service result
    return BaseApiResponse.success(null, result.message);
  }
}
