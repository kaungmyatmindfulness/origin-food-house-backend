import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SortCategoriesPayloadDto } from 'src/category/dto/sort-categories-payload.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ensure the user has OWNER or ADMIN role for the storeId from the JWT
   */
  private async checkOwnerOrAdmin(userId: number, storeId: number) {
    const membership = await this.prisma.userStore.findUnique({
      where: {
        userId_storeId: { userId, storeId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('User is not a member of this store');
    }
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException(
        'User does not have permission for this action',
      );
    }
  }

  // Create
  async create(userId: number, storeId: number, dto: CreateCategoryDto) {
    // 1) check role
    await this.checkOwnerOrAdmin(userId, storeId);

    // 2) find current max sortOrder for categories in this store
    const maxSort = await this.prisma.category.aggregate({
      where: { storeId },
      _max: { sortOrder: true },
    });
    const newSortOrder = (maxSort._max.sortOrder || 0) + 1;

    // 3) create category
    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        storeId,
        sortOrder: newSortOrder,
      },
    });
    return category;
  }

  // Find all categories for a store
  async findAll(storeId: number) {
    return this.prisma.category.findMany({
      where: { storeId },
      include: { menuItems: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Find one by ID
  async findOne(categoryId: number) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category not found (id=${categoryId})`);
    }
    return category;
  }

  // Update
  async update(
    userId: number,
    storeId: number,
    categoryId: number,
    dto: UpdateCategoryDto,
  ) {
    // Check role
    await this.checkOwnerOrAdmin(userId, storeId);

    // Check existence
    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!existing) {
      throw new NotFoundException(`Category not found (id=${categoryId})`);
    }
    if (existing.storeId !== storeId) {
      throw new ForbiddenException('Category does not belong to your store');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: dto.name ?? existing.name,
      },
    });
  }

  // Delete
  async remove(userId: number, storeId: number, categoryId: number) {
    // Check role
    await this.checkOwnerOrAdmin(userId, storeId);

    const existing = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!existing) {
      throw new NotFoundException(`Category not found (id=${categoryId})`);
    }
    if (existing.storeId !== storeId) {
      throw new ForbiddenException('Category does not belong to your store');
    }

    return this.prisma.category.delete({ where: { id: categoryId } });
  }

  /**
   * Bulk update sort orders for categories and their menu items
   */
  async sortCategoriesAndMenuItems(
    userId: number,
    storeId: number,
    payload: SortCategoriesPayloadDto,
  ) {
    // Optionally, check that the user is OWNER or ADMIN
    await this.checkOwnerOrAdmin(userId, storeId);

    // Start a transaction array to gather all update calls
    const ops = [];

    // For each category
    for (const cat of payload.categories) {
      // 1) check if this category belongs to the store
      const existingCat = await this.prisma.category.findUnique({
        where: { id: cat.id },
        select: { storeId: true },
      });
      if (!existingCat || existingCat.storeId !== storeId) {
        throw new ForbiddenException(
          `Category (id=${cat.id}) does not belong to your store`,
        );
      }
      // 2) queue an update for the category's sortOrder
      ops.push(
        this.prisma.category.update({
          where: { id: cat.id },
          data: { sortOrder: cat.sortOrder },
        }),
      );

      // 3) for each menu item
      for (const item of cat.menuItems) {
        // check item belongs to this store
        const existingItem = await this.prisma.menuItem.findUnique({
          where: { id: item.id },
          select: { storeId: true },
        });
        if (!existingItem || existingItem.storeId !== storeId) {
          throw new ForbiddenException(
            `Menu item (id=${item.id}) does not belong to your store`,
          );
        }
        ops.push(
          this.prisma.menuItem.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          }),
        );
      }
    }

    // run all updates in a single transaction
    await this.prisma.$transaction(ops);

    return { message: 'Categories & menu items reordered successfully' };
  }
}
