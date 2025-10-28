import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { RequestWithUser } from "src/auth/types";
import { GetCategoriesQueryDto } from "src/category/dto/get-categories-query.dto";
import { ApiSuccessResponse } from "src/common/decorators/api-success-response.decorator";
import { StandardApiErrorDetails } from "src/common/dto/standard-api-error-details.dto";
import { StandardApiResponse } from "src/common/dto/standard-api-response.dto";

import { CategoryService } from "./category.service";
import { CategoryBasicResponseDto } from "./dto/category-basic-response.dto";
import { CategoryDeletedResponseDto } from "./dto/category-deleted-response.dto";
import { CategoryResponseDto } from "./dto/category-response.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CustomizationGroupResponseDto } from "./dto/customization-group-response.dto";
import { CustomizationOptionResponseDto } from "./dto/customization-option-response.dto";
import { MenuItemNestedResponseDto } from "./dto/menu-item-nested-response.dto";
import { SortCategoriesPayloadDto } from "./dto/sort-categories-payload.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Categories")
@Controller("categories")
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
  @ApiOperation({ summary: "Create a new category (OWNER/ADMIN Required)" })
  @ApiSuccessResponse(CategoryBasicResponseDto, {
    status: HttpStatus.CREATED,
    description: "Category created successfully.",
  })
  async create(
    @Req() req: RequestWithUser,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
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
      "Category created successfully.",
    );
  }

  /**
   * GET All Categories for a Store (by ID or Slug)
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Get all active categories (with items) for a specific store (Public)",
    description:
      "Retrieves categories for a store using EITHER storeId OR storeSlug query parameter. Query parameters are defined in the GetCategoriesQueryDto schema.",
  })
  @ApiSuccessResponse(CategoryResponseDto, {
    isArray: true,
    description: "List of active categories with included active menu items.",
  })
  async findAll(
    @Query() query: GetCategoriesQueryDto,
  ): Promise<StandardApiResponse<CategoryResponseDto[]>> {
    const method = this.findAll.name;

    const identifier: { storeId?: string; storeSlug?: string } = {};
    let identifierLog: string;

    if (query.storeId) {
      identifier.storeId = query.storeId;
      identifierLog = `ID ${query.storeId}`;
    } else if (query.storeSlug) {
      identifier.storeSlug = query.storeSlug;
      identifierLog = `Slug ${query.storeSlug}`;
    } else {
      throw new BadRequestException(
        "Internal error: No store identifier found after validation.",
      );
    }

    const includeItems = true;

    this.logger.log(
      `[${method}] Fetching categories for Store [${identifierLog}], includeItems: ${includeItems}`,
    );

    const categories = await this.categoryService.findAll(
      identifier,
      includeItems,
    );

    return StandardApiResponse.success(
      categories,
      "Categories retrieved successfully.",
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific category by ID (Public)" })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category to fetch",
    type: String,
    format: "uuid",
  })
  @ApiQuery({
    name: "storeId",
    required: true,
    type: String,
    format: "uuid",
    description: "ID (UUID) of the store this category belongs to",
    example: "018ebc9a-7e1c-7f5e-b48a-3f4f72c55a1e",
  })
  async findOne(
    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
  ): Promise<StandardApiResponse<CategoryBasicResponseDto>> {
    const method = this.findOne.name;
    this.logger.log(
      `[${method}] Fetching category ID ${categoryId} within Store ${storeId} context.`,
    );

    const category = await this.categoryService.findOne(categoryId, storeId);
    return StandardApiResponse.success(
      category as CategoryBasicResponseDto,
      "Category retrieved successfully.",
    );
  }

  @Patch("sort")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Reorder categories and their menu items (OWNER/ADMIN Required)",
  })
  @ApiSuccessResponse(String, {
    description: "Categories and items reordered successfully.",
  })
  async sortCategories(
    @Req() req: RequestWithUser,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
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

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a category name (OWNER/ADMIN Required)" })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category to update",
    type: String,
    format: "uuid",
  })
  @ApiSuccessResponse(
    CategoryBasicResponseDto,
    "Category updated successfully.",
  )
  async update(
    @Req() req: RequestWithUser,

    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,
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
      "Category updated successfully.",
    );
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete a category (OWNER/ADMIN Required)" })
  @ApiParam({
    name: "id",
    description: "ID (UUID) of the category to delete",
    type: String,
    format: "uuid",
  })
  @ApiSuccessResponse(
    CategoryDeletedResponseDto,
    "Category deleted successfully.",
  )
  async remove(
    @Req() req: RequestWithUser,
    @Query("storeId", new ParseUUIDPipe({ version: "7" })) storeId: string,

    @Param("id", new ParseUUIDPipe({ version: "7" })) categoryId: string,
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
      "Category deleted successfully.",
    );
  }
}
