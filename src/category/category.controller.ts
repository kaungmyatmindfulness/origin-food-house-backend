import { RequestWithUser } from 'src/auth/types';
import { ApiSuccessResponse } from 'src/common/decorators/api-success-response.decorator';
import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';
import { StandardApiResponse } from 'src/common/dto/standard-api-response.dto';

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
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CategoryService } from './category.service';
import { CategoryBasicResponseDto } from './dto/category-basic-response.dto';
import { CategoryDeletedResponseDto } from './dto/category-deleted-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CustomizationGroupResponseDto } from './dto/customization-group-response.dto';
import { CustomizationOptionResponseDto } from './dto/customization-option-response.dto';
import { MenuItemNestedResponseDto } from './dto/menu-item-nested-response.dto';
import { SortCategoriesPayloadDto } from './dto/sort-categories-payload.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('Categories')
@Controller('categories')
@ApiExtraModels(
  StandardApiResponse,
  CategoryResponseDto,
  CategoryBasicResponseDto,
  CategoryDeletedResponseDto,
  MenuItemNestedResponseDto,
  CustomizationGroupResponseDto,
  CustomizationOptionResponseDto,
  StandardApiErrorDetails,
)
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new category (OWNER/ADMIN Required)' })
  @ApiSuccessResponse(CategoryBasicResponseDto, {
    status: HttpStatus.CREATED,
    description: 'Category created successfully.',
  })
  async create(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Body() dto: CreateCategoryDto,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const userId = req.user.sub;
    const method = this.create.name;
    this.logger.log(
      `[${method}] User ${userId} creating category in Store ${storeId}. Name: ${dto.name}`,
    );
    const category = await this.categoryService.create(userId, storeId, dto);

    return StandardApiResponse.success(
      category as CategoryBasicResponseDto,
      'Category created successfully.',
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Get all categories (with items) for a specific store (Public)',
  })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: Number,
    description: 'ID of the store',
    example: 1,
  })
  @ApiSuccessResponse(CategoryResponseDto, {
    isArray: true,
    description: 'List of categories with included menu items.',
  })
  async findAll(
    @Query('storeId', ParseIntPipe) storeId: number,
  ): Promise<StandardApiResponse<CategoryResponseDto[]>> {
    const method = this.findAll.name;
    const includeItems = true;

    this.logger.log(
      `[${method}] Fetching categories for Store ${storeId}, includeItems: ${includeItems}`,
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
  @ApiOperation({ summary: 'Get a specific category by ID (Public)' })
  @ApiParam({ name: 'id', description: 'ID of the category to retrieve' })
  @ApiQuery({
    name: 'storeId',
    required: true,
    type: Number,
    description: 'ID of the store this category belongs to',
    example: 1,
  })
  async findOne(
    @Param('id', ParseIntPipe) categoryId: number,
    @Query('storeId', ParseIntPipe) storeId: number,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const method = this.findOne.name;
    this.logger.log(
      `[${method}] Fetching category ID ${categoryId} within Store ${storeId} context.`,
    );

    const category = await this.categoryService.findOne(categoryId, storeId);
    return StandardApiResponse.success(
      category as CategoryBasicResponseDto,
      'Category retrieved successfully.',
    );
  }

  @Patch('sort')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reorder categories and their menu items (OWNER/ADMIN Required)',
  })
  @ApiSuccessResponse(String, {
    description: 'Categories and items reordered successfully.',
  })
  async sortCategories(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
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

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category name (OWNER/ADMIN Required)' })
  @ApiParam({ name: 'id', description: 'ID of the category to update' })
  @ApiSuccessResponse(
    CategoryBasicResponseDto,
    'Category updated successfully.',
  )
  async update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) categoryId: number,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
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
      updatedCategory as CategoryBasicResponseDto,
      'Category updated successfully.',
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (OWNER/ADMIN Required)' })
  @ApiParam({ name: 'id', description: 'ID of the category to delete' })
  @ApiSuccessResponse(
    CategoryDeletedResponseDto,
    'Category deleted successfully.',
  )
  async remove(
    @Req() req: RequestWithUser,
    @Query('storeId', ParseIntPipe) storeId: number,
    @Param('id', ParseIntPipe) categoryId: number,
  ): Promise<StandardApiResponse<CategoryDeletedResponseDto>> {
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
}
