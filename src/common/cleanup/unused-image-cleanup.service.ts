import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule"; // Use CronExpression for readability

import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../infra/s3.service";

// Configuration (Consider moving to config file/service)
const S3_IMAGE_PREFIX = "uploads/"; // Match the prefix used in UploadService
const IMAGE_SUFFIX_REGEX = /-(original|small|medium|large)(\..+)$/i; // Regex to match version suffixes and extensions

@Injectable()
export class UnusedImageCleanupService {
  private readonly logger = new Logger(UnusedImageCleanupService.name);
  private isJobRunning = false; // Simple lock to prevent overlap

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Extracts the base identifier (e.g., "uploads/uuid") from a full S3 key
   * (e.g., "uploads/uuid-thumb.webp"). Returns null if format doesn't match.
   */
  private getBaseIdentifierFromS3Key(s3Key: string): string | null {
    if (!s3Key?.startsWith(S3_IMAGE_PREFIX)) {
      return null;
    }
    // Remove suffix and extension (e.g., "-thumb.webp")
    const baseIdentifier = s3Key.replace(IMAGE_SUFFIX_REGEX, "");
    // Ensure the replacement actually happened (i.e., it had a suffix we expect)
    // and that the base isn't empty or just the prefix
    if (
      baseIdentifier === s3Key ||
      baseIdentifier.length <= S3_IMAGE_PREFIX.length
    ) {
      this.logger.warn(
        `[Cleanup] S3 key "${s3Key}" did not match expected format with suffix.`,
      );
      return null; // Key doesn't match expected pattern (e.g., is not a generated image version)
    }
    return baseIdentifier; // e.g., "uploads/some-uuid"
  }

  /**
   * Validates and returns the base path from database.
   * Database now stores base paths directly (e.g., "uploads/uuid"), not full URLs.
   */
  private getBaseIdentifierFromDbKey(
    dbPath: string | null | undefined,
  ): string | null {
    // Database stores base paths directly now
    if (!dbPath?.startsWith(S3_IMAGE_PREFIX)) {
      // Also check for payment-proofs prefix
      if (!dbPath?.startsWith("payment-proofs/")) {
        return null;
      }
    }
    // Return the path as-is (already a base path)
    return dbPath;
  }

  /**
   * Runs monthly (1st day of the month at midnight) to clean up unused S3 images.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT) // Use readable expression
  async handleCleanupUnusedImages() {
    if (this.isJobRunning) {
      this.logger.warn("Cleanup job already running. Skipping this execution.");
      return;
    }
    this.isJobRunning = true;
    this.logger.log("Starting monthly cleanup of unused images...");

    try {
      // 1. Get all base identifiers used in the database
      this.logger.verbose("Fetching used image keys from database...");
      const usedBaseIdentifiers = await this.getUsedBaseIdentifiersFromDB();
      this.logger.log(
        `Found ${usedBaseIdentifiers.size} unique base image identifiers in use.`,
      );

      // 2. List all relevant objects in S3
      this.logger.verbose(
        `Listing objects in S3 bucket with prefix: ${S3_IMAGE_PREFIX}`,
      );
      const allS3Keys = await this.s3Service.listAllObjectKeys(S3_IMAGE_PREFIX);
      this.logger.log(
        `Found ${allS3Keys.length} total objects in S3 with prefix.`,
      );

      // 3. Group S3 keys by their base identifier
      const s3KeysByBaseIdentifier = new Map<string, string[]>();
      for (const s3Key of allS3Keys) {
        const baseIdentifier = this.getBaseIdentifierFromS3Key(s3Key);
        if (baseIdentifier) {
          if (!s3KeysByBaseIdentifier.has(baseIdentifier)) {
            s3KeysByBaseIdentifier.set(baseIdentifier, []);
          }
          s3KeysByBaseIdentifier.get(baseIdentifier)?.push(s3Key);
        } else {
          // Log keys that don't match the expected pattern - might be manually uploaded or different format?
          this.logger.warn(
            `S3 key "${s3Key}" does not match expected image version pattern. Skipping.`,
          );
        }
      }
      this.logger.verbose(
        `Grouped S3 keys into ${s3KeysByBaseIdentifier.size} base identifiers.`,
      );

      // 4. Determine keys to delete
      const keysToDelete: string[] = [];
      for (const [baseIdentifier, s3Keys] of s3KeysByBaseIdentifier.entries()) {
        if (!usedBaseIdentifiers.has(baseIdentifier)) {
          // If the base identifier from S3 is NOT used in the DB, mark all its keys for deletion
          keysToDelete.push(...s3Keys);
        }
      }

      if (keysToDelete.length === 0) {
        this.logger.log("No unused images found to delete.");
      } else {
        this.logger.log(
          `Identified ${keysToDelete.length} unused S3 object(s) for deletion.`,
        );

        // 5. Delete unused keys using bulk operation
        const { deletedKeys, errors } =
          await this.s3Service.deleteFiles(keysToDelete);
        this.logger.log(
          `Cleanup finished. Successfully deleted ${deletedKeys.length} object(s). Encountered ${errors.length} deletion errors.`,
        );
        if (errors.length > 0) {
          this.logger.error(
            `Deletion errors occurred: ${JSON.stringify(errors)}`,
          );
          // Decide if partial success is acceptable or if you need alerting/retry logic
        }
      }
    } catch (error) {
      this.logger.error(`Cleanup job failed:`, error);
      // Handle specific errors if needed
    } finally {
      this.isJobRunning = false; // Release lock
      this.logger.log("Finished weekly cleanup job execution.");
    }
  }

  /**
   * Fetches all unique base image identifiers currently referenced in the database.
   * Add queries for other tables/columns that store image keys here.
   */
  private async getUsedBaseIdentifiersFromDB(): Promise<Set<string>> {
    const usedKeys = new Set<string>();

    // Query MenuItem table
    const menuItemImagePaths = await this.prisma.menuItem.findMany({
      where: { imagePath: { not: null } },
      select: { imagePath: true },
    });
    menuItemImagePaths.forEach((item) => {
      if (!item.imagePath) return;
      const baseId = this.getBaseIdentifierFromDbKey(item.imagePath);
      if (baseId) usedKeys.add(baseId);
    });

    // Query StoreInformation table for logos
    const storeLogos = await this.prisma.storeInformation.findMany({
      where: { logoPath: { not: null } },
      select: { logoPath: true },
    });
    storeLogos.forEach((item) => {
      const baseId = this.getBaseIdentifierFromDbKey(item.logoPath);
      if (baseId) usedKeys.add(baseId);
    });

    // Query StoreInformation table for cover photos
    const storeCoverPhotos = await this.prisma.storeInformation.findMany({
      where: { coverPhotoPath: { not: null } },
      select: { coverPhotoPath: true },
    });
    storeCoverPhotos.forEach((item) => {
      if (!item.coverPhotoPath) return;
      const baseId = this.getBaseIdentifierFromDbKey(item.coverPhotoPath);
      if (baseId) usedKeys.add(baseId);
    });

    this.logger.verbose(
      `Collected base identifiers: ${usedKeys.size} from MenuItem.imagePath, StoreInformation.logoPath, and StoreInformation.coverPhotoPath`,
    );

    return usedKeys;
  }
}
