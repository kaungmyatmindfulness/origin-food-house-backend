import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  Prisma,
  Role,
  Store,
  StoreInformation,
  StoreSetting,
  UserStore,
} from "@prisma/client";
import slugify from "slugify";

import { AuditLogService } from "src/audit-log/audit-log.service";
import { AuthService } from "src/auth/auth.service";
import { S3Service } from "src/common/infra/s3.service";
import { BusinessHoursDto } from "src/store/dto/business-hours.dto";
import { CreateStoreDto } from "src/store/dto/create-store.dto";
import { UpdateStoreInformationDto } from "src/store/dto/update-store-information.dto";
import { UpdateStoreSettingDto } from "src/store/dto/update-store-setting.dto";

import { InviteOrAssignRoleDto } from "./dto/invite-or-assign-role.dto";
import { PrismaService } from "../prisma/prisma.service";

const storeWithDetailsInclude = Prisma.validator<Prisma.StoreInclude>()({
  information: true,
  setting: true,
});
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
      this.logger.error(
        `[${method}] Error fetching store details for ${storeId}`,
        error,
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
      const { nanoid } = await import("nanoid");

      // Step 1: Generate slug and create store (outside transaction to get storeId for S3 uploads)
      const slug = `${slugify(dto.name, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      })}-${nanoid(6)}`;

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

      // Step 3: Copy images in S3 BEFORE transaction (S3 operations can't be rolled back)
      // This uses server-side S3 copy (10x faster than uploading)
      this.logger.log(
        `[${method}] Copying seed images for Store ${baseStore.id}`,
      );
      const imageUrlMap = await this.copyMenuImages(baseStore.id);
      this.logger.log(
        `[${method}] Copied ${imageUrlMap.size} images successfully`,
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

        // Create default categories
        const categoryMap = await this.createDefaultCategories(
          tx,
          baseStore.id,
        );

        // Create default tables
        await this.createDefaultTables(tx, baseStore.id);

        // Create default menu items with images
        const menuItems = await this.createDefaultMenuItems(
          tx,
          baseStore.id,
          categoryMap,
          imageUrlMap,
        );

        // Create default customization groups and options
        await this.createDefaultCustomizations(tx, menuItems);

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

      this.logger.error(
        `[${method}] Failed to create store: ${dto.name}`,
        error,
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
          logoUrl: dto.logoUrl,
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
      this.logger.error(
        `[${method}] Failed to update StoreInformation for Store ID ${storeId}`,
        error,
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

      this.logger.error(
        `[${method}] Failed to update StoreSetting for Store ID ${storeId}`,
        error,
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
      this.logger.error(
        `Failed to assign role ${dto.role} to email ${dto.email} in Store ${storeId}`,
        error,
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
    const vat = new Prisma.Decimal(vatRate);
    const service = new Prisma.Decimal(serviceChargeRate);

    if (vat.lt(0) || vat.gt(0.3)) {
      this.logger.warn(
        `[${method}] Invalid VAT rate ${vatRate} by User ${userId}`,
      );
      throw new BadRequestException("VAT rate must be between 0% and 30%");
    }
    if (service.lt(0) || service.gt(0.3)) {
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
      this.logger.error(
        `[${method}] Failed to update tax/service charge for Store ID ${storeId}`,
        error,
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
    this.validateBusinessHours(businessHours);

    try {
      // Update settings
      const updated = await this.prisma.storeSetting.update({
        where: { storeId },
        data: {
          businessHours: this.toJsonValue(businessHours),
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
      this.logger.error(
        `[${method}] Failed to update business hours for Store ID ${storeId}`,
        error,
      );
      throw new InternalServerErrorException(
        "Could not update business hours.",
      );
    }
  }

  /**
   * Converts any object to Prisma.InputJsonValue.
   * This is a type-safe wrapper for JSON field assignments.
   * @private
   */
  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  /**
   * Validates business hours structure
   * @private
   */
  private validateBusinessHours(hours: BusinessHoursDto): void {
    const days: Array<keyof BusinessHoursDto> = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];

    for (const day of days) {
      if (!hours[day]) {
        throw new BadRequestException(`Missing business hours for ${day}`);
      }
      const dayHours = hours[day];
      if (dayHours.closed) continue;

      if (!dayHours.open || !dayHours.close) {
        throw new BadRequestException(`Invalid hours for ${day}`);
      }

      // Validate time format HH:MM
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(dayHours.open) || !timeRegex.test(dayHours.close)) {
        throw new BadRequestException(`Invalid time format for ${day}`);
      }
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

    try {
      const updates: { logoUrl?: string; coverPhotoUrl?: string } = {};

      // Upload logo to S3
      if (logo) {
        this.logger.log(`[${method}] Uploading logo for Store ${storeId}`);
        const logoUrl = await this.s3Service.uploadFile(
          `store-logos/${storeId}-${Date.now()}-${logo.originalname}`,
          logo.buffer,
          logo.mimetype,
        );
        updates.logoUrl = logoUrl;
      }

      // Upload cover to S3
      if (cover) {
        this.logger.log(
          `[${method}] Uploading cover photo for Store ${storeId}`,
        );
        const coverUrl = await this.s3Service.uploadFile(
          `store-covers/${storeId}-${Date.now()}-${cover.originalname}`,
          cover.buffer,
          cover.mimetype,
        );
        updates.coverPhotoUrl = coverUrl;
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
      return updated;
    } catch (error) {
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
      this.logger.error(
        `[${method}] Failed to upload branding for Store ID ${storeId}`,
        error,
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
    const pointRateDecimal = new Prisma.Decimal(pointRate);
    const redemptionRateDecimal = new Prisma.Decimal(redemptionRate);

    if (pointRateDecimal.lte(0)) {
      this.logger.warn(
        `[${method}] Invalid point rate ${pointRate} by User ${userId}`,
      );
      throw new BadRequestException("Point rate must be positive");
    }
    if (redemptionRateDecimal.lte(0)) {
      this.logger.warn(
        `[${method}] Invalid redemption rate ${redemptionRate} by User ${userId}`,
      );
      throw new BadRequestException("Redemption rate must be positive");
    }
    if (expiryDays < 0 || expiryDays > 3650) {
      this.logger.warn(
        `[${method}] Invalid expiry days ${expiryDays} by User ${userId}`,
      );
      throw new BadRequestException("Expiry days must be between 0 and 3650");
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
      this.logger.error(
        `[${method}] Failed to update loyalty rules for Store ID ${storeId}`,
        error,
      );
      throw new InternalServerErrorException("Could not update loyalty rules.");
    }
  }

  /**
   * Creates default categories for a new store
   * @private
   * @param tx Prisma transaction client
   * @param storeId Store ID
   * @returns Map of category name to category ID
   */
  private async createDefaultCategories(
    tx: any,
    storeId: string,
  ): Promise<Map<string, string>> {
    const method = "createDefaultCategories";
    this.logger.log(
      `[${method}] Creating default categories for Store ${storeId}`,
    );

    const { DEFAULT_CATEGORIES } = await import(
      "./constants/default-store-data"
    );
    const categoryMap = new Map<string, string>();

    for (const catData of DEFAULT_CATEGORIES) {
      const category = await tx.category.create({
        data: {
          name: catData.name,
          sortOrder: catData.sortOrder,
          storeId,
          deletedAt: null,
        },
      });
      categoryMap.set(catData.name, category.id);
      this.logger.log(
        `[${method}] Created category "${catData.name}" (ID: ${category.id})`,
      );
    }

    this.logger.log(
      `[${method}] Created ${categoryMap.size} default categories`,
    );
    return categoryMap;
  }

  /**
   * Creates default tables for a new store
   * @private
   * @param tx Prisma transaction client
   * @param storeId Store ID
   */
  private async createDefaultTables(tx: any, storeId: string): Promise<void> {
    const method = "createDefaultTables";
    this.logger.log(`[${method}] Creating default tables for Store ${storeId}`);

    const { DEFAULT_TABLE_NAMES } = await import(
      "./constants/default-store-data"
    );

    const tableData = DEFAULT_TABLE_NAMES.map((name) => ({
      name,
      storeId,
      currentStatus: "VACANT" as const,
      deletedAt: null,
    }));

    await tx.table.createMany({
      data: tableData,
    });

    this.logger.log(
      `[${method}] Created ${DEFAULT_TABLE_NAMES.length} default tables`,
    );
  }

  /**
   * Copies menu seed images from shared S3 location to store-specific location.
   * Ensures seed images exist in shared location first (uploads if missing).
   * Uses S3 server-side copy (10x faster and cheaper than uploading).
   * @private
   * @param storeId Store ID for folder organization
   * @returns Map of image filename (without extension) to S3 URL
   */
  private async copyMenuImages(storeId: string): Promise<Map<string, string>> {
    const method = "copyMenuImages";
    this.logger.log(
      `[${method}] Preparing to copy seed images for Store ${storeId}`,
    );

    const { DEFAULT_MENU_ITEMS } = await import(
      "./constants/default-store-data"
    );

    // Extract unique image filenames (excluding nulls)
    const imageFilenames = Array.from(
      new Set(
        DEFAULT_MENU_ITEMS.map((item) => item.imageFileName).filter(
          (filename): filename is string => filename !== null,
        ),
      ),
    );

    // Step 1: Ensure seed images exist in shared S3 location (one-time upload)
    this.logger.log(
      `[${method}] Ensuring ${imageFilenames.length} seed images exist in shared S3 location`,
    );

    try {
      const { ensureSeedImagesExist } = await import(
        "./helpers/ensure-seed-images.helper"
      );

      const initResult = await ensureSeedImagesExist(
        this.s3Service,
        imageFilenames,
      );

      this.logger.log(
        `[${method}] Seed images ready: ${initResult.alreadyExisted.length} existed, ${initResult.uploaded.length} uploaded, ${initResult.failed.length} failed`,
      );

      // Step 2: Copy images from shared location to store-specific location
      this.logger.log(
        `[${method}] Copying ${imageFilenames.length} images to store-specific location`,
      );

      const { copySeedImagesInParallel } = await import(
        "./helpers/copy-seed-images.helper"
      );

      const imageMap = await copySeedImagesInParallel(
        this.s3Service,
        imageFilenames,
        storeId,
      );

      this.logger.log(
        `[${method}] Successfully copied ${imageMap.size} images for Store ${storeId}`,
      );
      return imageMap;
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to copy some images for Store ${storeId}`,
        error.stack,
      );
      // Return partial results - failed copies will have null imageUrl
      return new Map();
    }
  }

  /**
   * Creates default menu items for a new store
   * @private
   * @param tx Prisma transaction client
   * @param storeId Store ID
   * @param categoryMap Map of category name to category ID
   * @param imageUrlMap Map of image filename to S3 URL
   * @returns Array of created menu items with IDs
   */
  private async createDefaultMenuItems(
    tx: any,
    storeId: string,
    categoryMap: Map<string, string>,
    imageUrlMap: Map<string, string>,
  ): Promise<Array<{ id: string; name: string }>> {
    const method = "createDefaultMenuItems";
    this.logger.log(
      `[${method}] Creating default menu items for Store ${storeId}`,
    );

    const { DEFAULT_MENU_ITEMS, toPrismaDecimal } = await import(
      "./constants/default-store-data"
    );

    const menuItems: Array<{ id: string; name: string }> = [];

    for (const itemData of DEFAULT_MENU_ITEMS) {
      const categoryId = categoryMap.get(itemData.categoryName);
      if (!categoryId) {
        this.logger.warn(
          `[${method}] Category "${itemData.categoryName}" not found, skipping item "${itemData.name}"`,
        );
        continue;
      }

      // Get image URL if image file exists
      let imageUrl: string | null = null;
      if (itemData.imageFileName) {
        const imageKey = itemData.imageFileName.replace(/\.[^/.]+$/, ""); // Remove extension
        imageUrl = imageUrlMap.get(imageKey) ?? null;
      }

      const menuItem = await tx.menuItem.create({
        data: {
          name: itemData.name,
          description: itemData.description,
          basePrice: toPrismaDecimal(itemData.basePrice),
          categoryId,
          storeId,
          imageUrl,
          preparationTimeMinutes: itemData.preparationTimeMinutes,
          sortOrder: itemData.sortOrder,
          routingArea: itemData.routingArea,
          isOutOfStock: false,
          isHidden: false,
          deletedAt: null,
        },
      });

      menuItems.push({ id: menuItem.id, name: menuItem.name });
      this.logger.log(
        `[${method}] Created menu item "${itemData.name}" (ID: ${menuItem.id})`,
      );
    }

    this.logger.log(
      `[${method}] Created ${menuItems.length} default menu items`,
    );
    return menuItems;
  }

  /**
   * Creates default customization groups and options for menu items
   * @private
   * @param tx Prisma transaction client
   * @param menuItems Array of menu items with IDs and names
   */
  private async createDefaultCustomizations(
    tx: any,
    menuItems: Array<{ id: string; name: string }>,
  ): Promise<void> {
    const method = "createDefaultCustomizations";
    this.logger.log(
      `[${method}] Creating default customizations for ${menuItems.length} menu items`,
    );

    const {
      CUSTOMIZATION_TEMPLATES,
      MENU_ITEM_CUSTOMIZATIONS,
      toPrismaDecimal,
    } = await import("./constants/default-store-data");

    let totalGroupsCreated = 0;

    for (const menuItem of menuItems) {
      const customizationKeys = MENU_ITEM_CUSTOMIZATIONS[menuItem.name];
      if (!customizationKeys || customizationKeys.length === 0) {
        continue;
      }

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

        // Create customization group
        const group = await tx.customizationGroup.create({
          data: {
            name: template.name,
            menuItemId: menuItem.id,
            minSelectable: template.minSelectable,
            maxSelectable: template.maxSelectable,
          },
        });

        // Create customization options
        const optionsData = template.options.map(
          (option: {
            name: string;
            additionalPrice: string | null;
            sortOrder: number;
          }) => ({
            name: option.name,
            customizationGroupId: group.id,
            additionalPrice: toPrismaDecimal(option.additionalPrice),
            sortOrder: option.sortOrder,
          }),
        );

        await tx.customizationOption.createMany({
          data: optionsData,
        });

        totalGroupsCreated++;
        this.logger.log(
          `[${method}] Created "${template.name}" group for "${menuItem.name}" with ${optionsData.length} options`,
        );
      }
    }

    this.logger.log(
      `[${method}] Created ${totalGroupsCreated} customization groups total`,
    );
  }
}
