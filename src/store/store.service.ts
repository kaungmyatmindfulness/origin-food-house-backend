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
   * Handles potential slug conflicts.
   */
  async createStore(userId: string, dto: CreateStoreDto): Promise<Store> {
    this.logger.log(
      `User ${userId} attempting to create store with slug: ${dto.name}`,
    );

    try {
      const { nanoid } = await import("nanoid");
      const result = await this.prisma.$transaction(async (tx) => {
        const slug = `${slugify(dto.name, {
          lower: true,
          strict: true,
          remove: /[*+~.()'"!:@]/g,
        })}-${nanoid(6)}`;

        const existingStore = await tx.store.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (existingStore) {
          throw new BadRequestException(
            `Store slug "${slug}" is already taken.`,
          );
        }

        const store = await tx.store.create({
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
          `Store '${dto.name}' (ID: ${store.id}, Slug: ${store.slug}) created within transaction.`,
        );

        await tx.userStore.create({
          data: {
            userId,
            storeId: store.id,
            role: Role.OWNER,
          },
        });
        this.logger.log(
          `User ${userId} assigned as OWNER for new Store ID: ${store.id}.`,
        );

        return store;
      });
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(`Failed to create store with name ${dto.name}`, error);
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
}
