/**
 * Store Service
 *
 * ARCHITECTURAL NOTE: This service delegates entity creation to their respective
 * services (CategoryService, TableService, MenuService) during store seeding.
 * Each service provides seeding methods that accept a transaction client for atomicity.
 *
 * Benefits:
 * 1. Single Responsibility: Each service handles its own domain
 * 2. Code Reuse: Seeding logic is centralized in domain services
 * 3. Maintainability: Changes to entity creation only need to be made in one place
 * 4. Transaction Support: Services accept tx client for atomic operations
 *
 * @see CategoryService.createBulkForSeeding
 * @see TableService.createBulkForSeeding
 * @see MenuService.createBulkMenuItemsForSeeding
 * @see MenuService.createCustomizationsForSeeding
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { nanoid } from "nanoid";
import slugify from "slugify";

import { AuditLogService } from "src/audit-log/audit-log.service";
import { AuthService } from "src/auth/auth.service";
import { CategoryService } from "src/category/category.service";
import { S3Service } from "src/common/infra/s3.service";
import { Decimal } from "src/common/types/decimal.type";
import { UploadService } from "src/common/upload/upload.service";
import { getErrorDetails } from "src/common/utils/error.util";
import {
  Prisma,
  Role,
  RoutingArea,
  Store,
  StoreInformation,
  StoreSetting,
  UserStore,
} from "src/generated/prisma/client";
import {
  MenuService,
  SeedMenuItemInput,
  SeedCustomizationGroupInput,
} from "src/menu/menu.service";
import { BusinessHoursDto } from "src/store/dto/business-hours.dto";
import { CreateStoreDto } from "src/store/dto/create-store.dto";
import { UpdateStoreInformationDto } from "src/store/dto/update-store-information.dto";
import { UpdateStoreSettingDto } from "src/store/dto/update-store-setting.dto";
import { TableService } from "src/table/table.service";

import {
  CUSTOMIZATION_TEMPLATES,
  DEFAULT_CATEGORIES,
  DEFAULT_MENU_ITEMS,
  DEFAULT_TABLE_NAMES,
  MENU_ITEM_CUSTOMIZATIONS,
  toPrismaDecimal,
} from "./constants/default-store-data";
import { InviteOrAssignRoleDto } from "./dto/invite-or-assign-role.dto";
import { emptyToNull, toJsonValue } from "./helpers/data-conversion.helper";
import { processSeedImagesInParallel } from "./helpers/process-seed-images.helper";
import { validateBusinessHours } from "./helpers/validation.helper";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Constants for store service validations
 */
const MAX_RATE_PERCENTAGE = new Decimal("0.3"); // 30% maximum for VAT/service charge
const MIN_RATE = new Decimal("0"); // 0% minimum for rates
const MAX_LOYALTY_EXPIRY_DAYS = 3650; // 10 years maximum
const MIN_LOYALTY_EXPIRY_DAYS = 0; // No expiry minimum
const NANOID_LENGTH = 6; // Length of random slug suffix

/**
 * Type for Prisma transaction client
 * Used in transaction callbacks to ensure type safety
 */
type TransactionClient = Parameters<
  Parameters<PrismaService["$transaction"]>[0]
>[0];

const storeWithDetailsInclude = {
  information: true,
  setting: true,
} satisfies Prisma.StoreInclude;
type StoreWithDetailsPayload = Prisma.StoreGetPayload<{
  include: typeof storeWithDetailsInclude;
}>;

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private auditLogService: AuditLogService,
    private s3Service: S3Service,
    private uploadService: UploadService,
    private categoryService: CategoryService,
    private tableService: TableService,
    private menuService: MenuService,
  ) {}

  /**
   * Retrieves PUBLIC details for a specific store, including information and settings.
   * Does not require authentication or membership.
   * @param storeId The ID (UUID) of the store to retrieve.
   * @returns The Store object with nested information and setting.
   * @throws {NotFoundException} If the store is not found.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async getStoreDetails(storeId: string): Promise<StoreWithDetailsPayload> {
    // Removed userId parameter
    const method = this.getStoreDetails.name;
    // Updated log message
    this.logger.log(
      `[${method}] Fetching public details for Store ID: ${storeId}`,
    );

    // REMOVED: Membership check (await this.checkStoreMembership(userId, storeId);)

    try {
      // Fetch store details directly by ID
      const storeDetails = await this.prisma.store.findUniqueOrThrow({
        where: { id: storeId },
        include: storeWithDetailsInclude, // Use defined include { information: true, setting: true }
      });
      // NOTE: If settings/info contain sensitive data visible only to members,
      // you might need separate public/private fetch methods or use Prisma $omit / DTO mapping.
      // Assuming information/setting are safe for public view here.
      return storeDetails;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        // P2025 from findUniqueOrThrow
        this.logger.warn(`[${method}] Store ${storeId} not found.`);
        throw new NotFoundException(`Store with ID ${storeId} not found.`);
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Error fetching store details for ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Could not retrieve store details.",
      );
    }
  }

  /**
   * Creates a new store with its information and assigns the creator as OWNER.
   * Automatically populates with default demo data: categories, tables, menu items, and customization groups.
   * Handles potential slug conflicts.
   */
  async createStore(userId: string, dto: CreateStoreDto): Promise<Store> {
    const method = this.createStore.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to create store: ${dto.name}`,
    );

    try {
      // Step 1: Generate slug and create store (outside transaction to get storeId for S3 uploads)
      const slug = `${slugify(dto.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      })}-${nanoid(NANOID_LENGTH)}`;

      // Check slug uniqueness
      const existingStore = await this.prisma.store.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (existingStore) {
        throw new BadRequestException(`Store slug "${slug}" is already taken.`);
      }

      // Step 2: Create base store and get ID
      const baseStore = await this.prisma.store.create({
        data: {
          slug,
          information: {
            create: {
              name: dto.name,
              address: emptyToNull(dto.address),
              phone: emptyToNull(dto.phone),
              email: emptyToNull(dto.email),
              website: emptyToNull(dto.website),
            },
          },
          setting: {
            create: {},
          },
        },
      });
      this.logger.log(
        `[${method}] Base store '${dto.name}' created (ID: ${baseStore.id}, Slug: ${baseStore.slug})`,
      );

      // Step 3: Process seed images BEFORE transaction
      // Reads local seed images and uploads them as multi-size WebP versions
      this.logger.log(
        `[${method}] Processing seed images for Store ${baseStore.id}`,
      );
      const imagePathMap = await this.processMenuImages(baseStore.id);
      this.logger.log(
        `[${method}] Processed ${imagePathMap.size} images successfully`,
      );

      // Step 4: Create all default data in a single transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Assign user as OWNER
        await tx.userStore.create({
          data: {
            userId,
            storeId: baseStore.id,
            role: Role.OWNER,
          },
        });
        this.logger.log(
          `[${method}] User ${userId} assigned as OWNER for Store ${baseStore.id}`,
        );

        // Create default categories (delegated to CategoryService)
        const categoryMap = await this.categoryService.createBulkForSeeding(
          tx,
          baseStore.id,
          DEFAULT_CATEGORIES,
        );

        // Create default tables (delegated to TableService)
        await this.tableService.createBulkForSeeding(
          tx,
          baseStore.id,
          DEFAULT_TABLE_NAMES,
        );

        // Create default menu items with images (delegated to MenuService)
        const menuItemInputs = this.prepareMenuItemsForSeeding(
          categoryMap,
          imagePathMap,
        );
        const menuItems = await this.menuService.createBulkMenuItemsForSeeding(
          tx,
          baseStore.id,
          menuItemInputs,
        );

        // Create default customization groups and options (delegated to MenuService)
        await this.createCustomizationsForMenuItems(tx, menuItems);

        this.logger.log(
          `[${method}] All default data created successfully for Store ${baseStore.id}`,
        );

        return baseStore;
      });

      this.logger.log(
        `[${method}] Store '${dto.name}' created successfully with full demo data`,
      );
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to create store: ${dto.name}`,
        stack,
      );
      throw new InternalServerErrorException("Could not create store.");
    }
  }

  /**
   * Updates store information details. Requires OWNER or ADMIN role for the associated Store.
   * @param userId The ID (UUID) of the user performing the action.
   * @param storeId The ID (UUID) of the Store whose information is being updated.
   * @param dto DTO containing the fields to update.
   * @returns The updated StoreInformation object.
   * @throws {NotFoundException} If StoreInformation for the storeId is not found.
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateStoreInformation(
    userId: string,
    storeId: string,
    dto: UpdateStoreInformationDto,
  ): Promise<StoreInformation> {
    const method = this.updateStoreInformation.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update StoreInformation for Store ID: ${storeId}.`,
    );

    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    try {
      const result = await this.prisma.storeInformation.update({
        where: { storeId },
        data: {
          name: dto.name,
          logoPath: dto.logoPath,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          website: dto.website,
        },
      });
      this.logger.log(
        `[${method}] StoreInformation for Store ID ${storeId} updated successfully by User ${userId}.`,
      );
      return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreInformation for Store ID ${storeId} not found.`,
          error.meta,
        );
        throw new NotFoundException(
          `Information for store with ID ${storeId} not found. Cannot update.`,
        );
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to update StoreInformation for Store ID ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Could not update store information.",
      );
    }
  }

  /**
   * Updates store settings (currency, rates). Requires OWNER or ADMIN role.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose settings are being updated.
   * @param dto DTO containing the fields to update.
   * @returns The updated StoreSetting object.
   * @throws {NotFoundException} If StoreSetting for the storeId is not found.
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateStoreSettings(
    userId: string,
    storeId: string,
    dto: UpdateStoreSettingDto,
  ): Promise<StoreSetting> {
    const method = this.updateStoreSettings.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update StoreSetting for Store ID: ${storeId}.`,
    );

    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    try {
      const updatedSettings = await this.prisma.storeSetting.update({
        where: { storeId },
        data: {
          currency: dto.currency,
          vatRate: dto.vatRate,
          serviceChargeRate: dto.serviceChargeRate,
        },
      });

      this.logger.log(
        `[${method}] StoreSetting for Store ID ${storeId} updated successfully by User ${userId}.`,
      );
      return updatedSettings;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreSetting for Store ID ${storeId} not found. Ensure settings were created with the store.`,
          error.meta,
        );
        throw new NotFoundException(
          `Settings for store with ID ${storeId} not found. Cannot update.`,
        );
      }

      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to update StoreSetting for Store ID ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Could not update store settings.",
      );
    }
  }

  /**
   * Invites an existing user or assigns/updates a role for them in a store.
   * - Requires acting user to be OWNER or ADMIN of the store.
   * - OWNER can assign any role.
   * - ADMIN can only assign STAFF or CHEF roles.
   * @throws NotFoundException if target user email doesn't exist.
   * @throws ForbiddenException if acting user lacks permission or tries to assign invalid role.
   * @throws BadRequestException if trying to assign OWNER role (should be handled differently).
   */
  async inviteOrAssignRoleByEmail(
    actingUserId: string,
    storeId: string,
    dto: InviteOrAssignRoleDto,
  ): Promise<UserStore> {
    this.logger.log(
      `User ${actingUserId} attempting to assign role ${dto.role} to email ${dto.email} in Store ${storeId}.`,
    );

    if (dto.role === Role.OWNER) {
      this.logger.warn(
        `Attempt by User ${actingUserId} to assign OWNER role via invite/assign method denied for Store ${storeId}.`,
      );
      throw new BadRequestException(
        "Cannot assign OWNER role using this method. Store ownership transfer requires a different process.",
      );
    }

    const actingUserMembership = await this.authService.getUserStoreRole(
      actingUserId,
      storeId,
    );
    const isOwner = actingUserMembership === Role.OWNER;

    if (!isOwner) {
      this.logger.warn(
        `Permission denied: User ${actingUserId} lacks OWNER role in Store ${storeId}.`,
      );
      throw new ForbiddenException(
        `You do not have permission to assign roles in Store ${storeId}.`,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { email: dto.email },
          select: { id: true },
        });

        if (!targetUser) {
          this.logger.warn(
            `Assign role failed: Target user with email ${dto.email} not found.`,
          );
          throw new NotFoundException(
            `No user found with email ${dto.email}. User must register first.`,
          );
        }

        this.logger.log(
          `Assigning role ${dto.role} to User ID ${targetUser.id} in Store ${storeId}.`,
        );
        const userStore = await tx.userStore.upsert({
          where: {
            userId_storeId: {
              userId: targetUser.id,
              storeId,
            },
          },
          update: { role: dto.role },
          create: {
            userId: targetUser.id,
            storeId,
            role: dto.role,
          },
        });

        this.logger.log(
          `Role ${dto.role} successfully assigned to User ID ${targetUser.id} in Store ID ${storeId}. Membership ID: ${userStore.id}`,
        );

        return userStore;
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `Failed to assign role ${dto.role} to email ${dto.email} in Store ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Could not assign role to user.");
    }
  }

  /**
   * Updates tax and service charge rates for a store.
   * Requires OWNER or ADMIN role.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose settings are being updated.
   * @param vatRate VAT rate as decimal string (e.g., "0.07" for 7%)
   * @param serviceChargeRate Service charge rate as decimal string (e.g., "0.10" for 10%)
   * @returns The updated StoreSetting object.
   * @throws {BadRequestException} If rates are invalid (must be 0-30%).
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateTaxAndServiceCharge(
    userId: string,
    storeId: string,
    vatRate: string,
    serviceChargeRate: string,
  ): Promise<StoreSetting> {
    const method = this.updateTaxAndServiceCharge.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update tax/service charge for Store ID: ${storeId}`,
    );

    // RBAC: Owner/Admin only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Validation: 0-30%
    const vat = new Decimal(vatRate);
    const service = new Decimal(serviceChargeRate);

    if (vat.lt(MIN_RATE) || vat.gt(MAX_RATE_PERCENTAGE)) {
      this.logger.warn(
        `[${method}] Invalid VAT rate ${vatRate} by User ${userId}`,
      );
      throw new BadRequestException("VAT rate must be between 0% and 30%");
    }
    if (service.lt(MIN_RATE) || service.gt(MAX_RATE_PERCENTAGE)) {
      this.logger.warn(
        `[${method}] Invalid service charge rate ${serviceChargeRate} by User ${userId}`,
      );
      throw new BadRequestException(
        "Service charge rate must be between 0% and 30%",
      );
    }

    try {
      // Get old values for audit log
      const oldSetting = await this.prisma.storeSetting.findUnique({
        where: { storeId },
      });

      if (!oldSetting) {
        this.logger.warn(
          `[${method}] StoreSetting for Store ID ${storeId} not found.`,
        );
        throw new NotFoundException(
          `Settings for store with ID ${storeId} not found.`,
        );
      }

      // Update settings
      const updated = await this.prisma.storeSetting.update({
        where: { storeId },
        data: {
          vatRate: vat,
          serviceChargeRate: service,
        },
      });

      // Audit log
      await this.auditLogService.logStoreSettingChange(
        storeId,
        userId,
        {
          field: "taxAndServiceCharge",
          oldValue: JSON.stringify({
            vat: oldSetting.vatRate?.toString() ?? "0",
            service: oldSetting.serviceChargeRate?.toString() ?? "0",
          }),
          newValue: JSON.stringify({
            vat: vatRate,
            service: serviceChargeRate,
          }),
        },
        undefined,
        undefined,
      );

      this.logger.log(
        `[${method}] Tax/service charge updated for Store ${storeId} by User ${userId}`,
      );
      return updated;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to update tax/service charge for Store ID ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Could not update tax and service charge.",
      );
    }
  }

  /**
   * Updates business hours for a store.
   * Requires OWNER or ADMIN role.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose settings are being updated.
   * @param businessHours Business hours object with days of the week
   * @returns The updated StoreSetting object.
   * @throws {BadRequestException} If business hours structure is invalid.
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateBusinessHours(
    userId: string,
    storeId: string,
    businessHours: BusinessHoursDto,
  ): Promise<StoreSetting> {
    const method = this.updateBusinessHours.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update business hours for Store ID: ${storeId}`,
    );

    // RBAC: Owner/Admin only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Validate business hours JSON structure
    validateBusinessHours(businessHours);

    try {
      // Update settings
      const updated = await this.prisma.storeSetting.update({
        where: { storeId },
        data: {
          businessHours: toJsonValue(businessHours),
        },
      });

      // Audit log
      await this.auditLogService.logStoreSettingChange(
        storeId,
        userId,
        {
          field: "businessHours",
          oldValue: "null",
          newValue: JSON.stringify(businessHours),
        },
        undefined,
        undefined,
      );

      this.logger.log(
        `[${method}] Business hours updated for Store ${storeId} by User ${userId}`,
      );
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreSetting for Store ID ${storeId} not found.`,
        );
        throw new NotFoundException(
          `Settings for store with ID ${storeId} not found.`,
        );
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to update business hours for Store ID ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException(
        "Could not update business hours.",
      );
    }
  }

  /**
   * Uploads branding images (logo and/or cover) for a store.
   * Requires OWNER or ADMIN role.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose branding is being updated.
   * @param logo Optional logo file to upload
   * @param cover Optional cover photo file to upload
   * @returns The updated StoreSetting object.
   * @throws {ForbiddenException} If user lacks permission for the Store.
   * @throws {InternalServerErrorException} On upload or database errors.
   */
  async uploadBranding(
    userId: string,
    storeId: string,
    logo?: Express.Multer.File,
    cover?: Express.Multer.File,
  ): Promise<StoreInformation> {
    const method = this.uploadBranding.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to upload branding for Store ID: ${storeId}`,
    );

    // RBAC: Owner/Admin only
    await this.authService.checkStorePermission(userId, storeId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    // Get existing paths for cleanup on success
    const existingInfo = await this.prisma.storeInformation.findUnique({
      where: { storeId },
      select: { logoPath: true, coverPhotoPath: true },
    });

    if (!existingInfo) {
      throw new NotFoundException(
        `Store information for store ${storeId} not found`,
      );
    }

    const oldPaths = {
      logo: existingInfo.logoPath,
      cover: existingInfo.coverPhotoPath,
    };

    const newPaths: string[] = [];

    try {
      const updates: { logoPath?: string; coverPhotoPath?: string } = {};

      // Upload logo using UploadService (generates multiple sizes)
      if (logo) {
        this.logger.log(`[${method}] Uploading logo for Store ${storeId}`);
        const logoResult = await this.uploadService.uploadImage(
          logo,
          "store-logo",
          storeId,
        );
        updates.logoPath = logoResult.basePath;
        newPaths.push(logoResult.basePath);
      }

      // Upload cover photo using UploadService (generates multiple sizes)
      if (cover) {
        this.logger.log(
          `[${method}] Uploading cover photo for Store ${storeId}`,
        );
        const coverResult = await this.uploadService.uploadImage(
          cover,
          "cover-photo",
          storeId,
        );
        updates.coverPhotoPath = coverResult.basePath;
        newPaths.push(coverResult.basePath);
      }

      // Update store information
      const updated = await this.prisma.storeInformation.update({
        where: { storeId },
        data: updates,
      });

      // Audit log
      await this.auditLogService.logStoreSettingChange(
        storeId,
        userId,
        { field: "branding", oldValue: "", newValue: JSON.stringify(updates) },
        undefined,
        undefined,
      );

      this.logger.log(
        `[${method}] Branding updated for Store ${storeId} by User ${userId}`,
      );

      // Delete old files only after database update succeeds
      if (oldPaths.logo && updates.logoPath) {
        await this.deleteImageVersions(oldPaths.logo, "store-logo").catch(
          (err) => {
            const { message } = getErrorDetails(err);
            this.logger.warn(
              `[${method}] Failed to delete old logo: ${message}`,
            );
          },
        );
      }

      if (oldPaths.cover && updates.coverPhotoPath) {
        await this.deleteImageVersions(oldPaths.cover, "cover-photo").catch(
          (err) => {
            const { message } = getErrorDetails(err);
            this.logger.warn(
              `[${method}] Failed to delete old cover photo: ${message}`,
            );
          },
        );
      }

      return updated;
    } catch (error) {
      // Cleanup newly uploaded files on database update failure
      this.logger.warn(
        `[${method}] Database update failed. Cleaning up newly uploaded files...`,
      );

      for (const newPath of newPaths) {
        try {
          const preset = newPath.includes("logo")
            ? "store-logo"
            : "cover-photo";
          await this.deleteImageVersions(newPath, preset);
          this.logger.log(`[${method}] Cleaned up uploaded file: ${newPath}`);
        } catch (cleanupError) {
          this.logger.error(
            `[${method}] Failed to cleanup uploaded file ${newPath}`,
            cleanupError,
          );
        }
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreInformation for Store ID ${storeId} not found.`,
        );
        throw new NotFoundException(
          `Information for store with ID ${storeId} not found.`,
        );
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to upload branding for Store ID ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Could not upload branding.");
    }
  }

  /**
   * Updates loyalty program rules for a store.
   * Requires OWNER role only.
   * @param userId The ID of the user performing the action.
   * @param storeId The ID of the Store whose loyalty rules are being updated.
   * @param pointRate Points per currency unit (e.g., '0.1' = 1 point per 10 THB)
   * @param redemptionRate Currency per point (e.g., '0.1' = 10 THB per 100 points)
   * @param expiryDays Number of days before points expire (0-3650)
   * @returns The updated StoreSetting object.
   * @throws {BadRequestException} If rates or expiry days are invalid.
   * @throws {ForbiddenException} If user lacks OWNER permission.
   * @throws {InternalServerErrorException} On unexpected database errors.
   */
  async updateLoyaltyRules(
    userId: string,
    storeId: string,
    pointRate: string,
    redemptionRate: string,
    expiryDays: number,
  ): Promise<StoreSetting> {
    const method = this.updateLoyaltyRules.name;
    this.logger.log(
      `[${method}] User ${userId} attempting to update loyalty rules for Store ID: ${storeId}`,
    );

    // RBAC: Owner only
    await this.authService.checkStorePermission(userId, storeId, [Role.OWNER]);

    // Validation
    const pointRateDecimal = new Decimal(pointRate);
    const redemptionRateDecimal = new Decimal(redemptionRate);

    if (pointRateDecimal.lte(MIN_RATE)) {
      this.logger.warn(
        `[${method}] Invalid point rate ${pointRate} by User ${userId}`,
      );
      throw new BadRequestException("Point rate must be positive");
    }
    if (redemptionRateDecimal.lte(MIN_RATE)) {
      this.logger.warn(
        `[${method}] Invalid redemption rate ${redemptionRate} by User ${userId}`,
      );
      throw new BadRequestException("Redemption rate must be positive");
    }
    if (
      expiryDays < MIN_LOYALTY_EXPIRY_DAYS ||
      expiryDays > MAX_LOYALTY_EXPIRY_DAYS
    ) {
      this.logger.warn(
        `[${method}] Invalid expiry days ${expiryDays} by User ${userId}`,
      );
      throw new BadRequestException(
        `Expiry days must be between ${MIN_LOYALTY_EXPIRY_DAYS} and ${MAX_LOYALTY_EXPIRY_DAYS}`,
      );
    }

    try {
      // Update settings
      const updated = await this.prisma.storeSetting.update({
        where: { storeId },
        data: {
          loyaltyPointRate: pointRateDecimal,
          loyaltyRedemptionRate: redemptionRateDecimal,
          loyaltyPointExpiryDays: expiryDays,
        },
      });

      // Audit log
      await this.auditLogService.logStoreSettingChange(
        storeId,
        userId,
        {
          field: "loyaltyRules",
          oldValue: "null",
          newValue: JSON.stringify({ pointRate, redemptionRate, expiryDays }),
        },
        undefined,
        undefined,
      );

      this.logger.log(
        `[${method}] Loyalty rules updated for Store ${storeId} by User ${userId}`,
      );
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        this.logger.warn(
          `[${method}] Update failed: StoreSetting for Store ID ${storeId} not found.`,
        );
        throw new NotFoundException(
          `Settings for store with ID ${storeId} not found.`,
        );
      }
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to update loyalty rules for Store ID ${storeId}`,
        stack,
      );
      throw new InternalServerErrorException("Could not update loyalty rules.");
    }
  }

  /**
   * Processes menu seed images for a new store.
   * Reads local seed image files and uploads them as multi-size WebP versions.
   * This ensures consistency with the new image system that uses base paths
   * and multiple size versions (small, medium, large).
   * @private
   * @param storeId Store ID for folder organization
   * @returns Map of image filename (without extension) to base S3 path
   */
  private async processMenuImages(
    storeId: string,
  ): Promise<Map<string, string>> {
    const method = "processMenuImages";
    this.logger.log(
      `[${method}] Preparing to process seed images for Store ${storeId}`,
    );

    // Extract unique image filenames (excluding nulls)
    const imageFilenames = Array.from(
      new Set(
        DEFAULT_MENU_ITEMS.map((item) => item.imageFileName).filter(
          (filename): filename is string => filename !== null,
        ),
      ),
    );

    this.logger.log(
      `[${method}] Processing ${imageFilenames.length} seed images for Store ${storeId}`,
    );

    try {
      const imageMap = await processSeedImagesInParallel(
        this.uploadService,
        imageFilenames,
        storeId,
      );

      this.logger.log(
        `[${method}] Successfully processed ${imageMap.size} images for Store ${storeId}`,
      );
      return imageMap;
    } catch (error) {
      const { stack } = getErrorDetails(error);
      this.logger.error(
        `[${method}] Failed to process some images for Store ${storeId}`,
        stack,
      );
      // Return partial results - failed uploads will have null imagePath
      return new Map();
    }
  }

  /**
   * Prepares menu item data for seeding by transforming DEFAULT_MENU_ITEMS
   * into SeedMenuItemInput format.
   *
   * @private
   * @param categoryMap Map of category name to category ID
   * @param imagePathMap Map of image filename to base S3 path
   * @returns Array of SeedMenuItemInput ready for MenuService
   */
  private prepareMenuItemsForSeeding(
    categoryMap: Map<string, string>,
    imagePathMap: Map<string, string>,
  ): SeedMenuItemInput[] {
    const method = "prepareMenuItemsForSeeding";
    const menuItemInputs: SeedMenuItemInput[] = [];

    for (const itemData of DEFAULT_MENU_ITEMS) {
      const categoryId = categoryMap.get(itemData.categoryName);
      if (!categoryId) {
        this.logger.warn(
          `[${method}] Category "${itemData.categoryName}" not found, skipping item "${itemData.name}"`,
        );
        continue;
      }

      // Get image path if image file exists
      let imagePath: string | null = null;
      if (itemData.imageFileName) {
        const imageKey = itemData.imageFileName.replace(/\.[^/.]+$/, ""); // Remove extension
        imagePath = imagePathMap.get(imageKey) ?? null;
      }

      // Convert basePrice to Decimal
      const basePrice = toPrismaDecimal(itemData.basePrice);

      menuItemInputs.push({
        name: itemData.name,
        description: itemData.description,
        basePrice,
        categoryId,
        imagePath,
        preparationTimeMinutes: itemData.preparationTimeMinutes,
        sortOrder: itemData.sortOrder,
        routingArea:
          (itemData.routingArea as RoutingArea | undefined) ??
          RoutingArea.OTHER,
        translations: itemData.translations.map((t) => ({
          locale: t.locale,
          name: t.name,
          description: t.description ?? null,
        })),
      });
    }

    this.logger.log(
      `[${method}] Prepared ${menuItemInputs.length} menu items for seeding`,
    );
    return menuItemInputs;
  }

  /**
   * Creates customization groups for menu items using MenuService.
   * Maps menu item names to customization templates and delegates creation.
   *
   * @private
   * @param tx Prisma transaction client
   * @param menuItems Array of menu items with IDs and names
   */
  private async createCustomizationsForMenuItems(
    tx: TransactionClient,
    menuItems: Array<{ id: string; name: string }>,
  ): Promise<void> {
    const method = "createCustomizationsForMenuItems";
    this.logger.log(
      `[${method}] Creating customizations for ${menuItems.length} menu items`,
    );

    let totalGroupsCreated = 0;

    for (const menuItem of menuItems) {
      const customizationKeys = MENU_ITEM_CUSTOMIZATIONS[menuItem.name];
      if (!customizationKeys || customizationKeys.length === 0) {
        continue;
      }

      // Build customization groups from templates
      const customizationGroups: SeedCustomizationGroupInput[] = [];

      for (const templateKey of customizationKeys) {
        const template =
          CUSTOMIZATION_TEMPLATES[
            templateKey as keyof typeof CUSTOMIZATION_TEMPLATES
          ];
        if (!template) {
          this.logger.warn(
            `[${method}] Template "${templateKey}" not found, skipping`,
          );
          continue;
        }

        customizationGroups.push({
          name: template.name,
          minSelectable: template.minSelectable,
          maxSelectable: template.maxSelectable,
          translations: template.translations.map((t) => ({
            locale: t.locale,
            name: t.name,
          })),
          options: template.options.map((opt) => ({
            name: opt.name,
            additionalPrice: toPrismaDecimal(opt.additionalPrice),
            sortOrder: opt.sortOrder,
            translations: opt.translations.map((t) => ({
              locale: t.locale,
              name: t.name,
            })),
          })),
        });
      }

      if (customizationGroups.length > 0) {
        await this.menuService.createCustomizationsForSeeding(
          tx,
          menuItem.id,
          customizationGroups,
        );
        totalGroupsCreated += customizationGroups.length;
      }
    }

    this.logger.log(
      `[${method}] Created ${totalGroupsCreated} customization groups`,
    );
  }

  /**
   * Deletes all versions of an image from S3.
   * Constructs version paths based on the preset and deletes each version.
   *
   * @param basePath Base S3 path without version suffix (e.g., "uploads/uuid")
   * @param preset Image size preset to determine which versions to delete
   * @throws {InternalServerErrorException} On S3 deletion errors
   */
  private async deleteImageVersions(
    basePath: string,
    preset: "store-logo" | "cover-photo" | "menu-item",
  ): Promise<void> {
    const method = "deleteImageVersions";
    this.logger.log(
      `[${method}] Deleting all versions for base path: ${basePath}`,
    );

    // Determine which versions to delete based on preset
    const versions: string[] = [];
    switch (preset) {
      case "store-logo":
        versions.push("small", "medium");
        break;
      case "cover-photo":
      case "menu-item":
        versions.push("small", "medium", "large");
        break;
    }

    // Delete each version
    const deletePromises = versions.map((version) => {
      const versionPath = `${basePath}-${version}.webp`;
      return this.s3Service.deleteFile(versionPath).catch((error) => {
        const { message } = getErrorDetails(error);
        this.logger.warn(
          `[${method}] Failed to delete version ${version} at ${versionPath}: ${message}`,
        );
        // Continue deleting other versions even if one fails
      });
    });

    await Promise.all(deletePromises);
    this.logger.log(
      `[${method}] Deleted ${versions.length} version(s) for ${basePath}`,
    );
  }
}
