import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule'; // Use CronExpression for readability
import { S3Service } from '../infra/s3.service';
import { PrismaService } from '../../prisma.service';
import * as path from 'path'; // Import path module

// Configuration (Consider moving to config file/service)
const S3_IMAGE_PREFIX = 'uploads/'; // Match the prefix used in UploadService
const IMAGE_SUFFIX_REGEX = /-(medium|thumb)(\..+)$/i; // Regex to match suffixes and extensions

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
    if (!s3Key || !s3Key.startsWith(S3_IMAGE_PREFIX)) {
      return null;
    }
    // Remove suffix and extension (e.g., "-thumb.webp")
    const baseIdentifier = s3Key.replace(IMAGE_SUFFIX_REGEX, '');
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
   * Extracts the base identifier (e.g., "uploads/uuid") from a DB-stored key
   * (e.g., "uploads/uuid.png"). Returns null if format is invalid.
   */
  private getBaseIdentifierFromDbKey(
    dbKey: string | null | undefined,
  ): string | null {
    if (!dbKey || !dbKey.startsWith(S3_IMAGE_PREFIX)) {
      return null;
    }
    try {
      const extension = path.extname(dbKey);
      if (!extension) return null; // Needs an extension
      // Return the part before the extension
      return dbKey.substring(0, dbKey.length - extension.length); // e.g., "uploads/some-uuid"
    } catch (e) {
      this.logger.error(`[Cleanup] Error parsing DB key "${dbKey}"`, e);
      return null;
    }
  }

  /**
   * Runs monthly (1st day of the month at midnight) to clean up unused S3 images.
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT) // Use readable expression
  async handleCleanupUnusedImages() {
    if (this.isJobRunning) {
      this.logger.warn('Cleanup job already running. Skipping this execution.');
      return;
    }
    this.isJobRunning = true;
    this.logger.log('Starting monthly cleanup of unused images...');

    try {
      // 1. Get all base identifiers used in the database
      this.logger.verbose('Fetching used image keys from database...');
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
        this.logger.log('No unused images found to delete.');
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
      this.logger.log('Finished weekly cleanup job execution.');
    }
  }

  /**
   * Fetches all unique base image identifiers currently referenced in the database.
   * Add queries for other tables/columns that store image keys here.
   */
  private async getUsedBaseIdentifiersFromDB(): Promise<Set<string>> {
    const usedKeys = new Set<string>();

    // Query MenuItem table
    const menuItemImageUrls = await this.prisma.menuItem.findMany({
      where: { imageUrl: { not: null } }, // Only fetch non-null keys
      select: { imageUrl: true },
    });
    menuItemImageUrls.forEach((item) => {
      const baseId = this.getBaseIdentifierFromDbKey(item.imageUrl);
      if (baseId) usedKeys.add(baseId);
    });

    // --- Add other sources here ---
    // Example: User avatars
    // const userAvatars = await this.prisma.user.findMany({
    //    where: { avatarKey: { not: null } },
    //    select: { avatarKey: true },
    // });
    // userAvatars.forEach(item => {
    //    const baseId = this.getBaseIdentifierFromDbKey(item.avatarKey);
    //    if(baseId) usedKeys.add(baseId);
    // });

    // Example: Store logos
    // const storeLogos = await this.prisma.store.findMany({
    //     where: { logoKey: { not: null } },
    //     select: { logoKey: true },
    // });
    // storeLogos.forEach(item => {
    //     const baseId = this.getBaseIdentifierFromDbKey(item.logoKey);
    //     if(baseId) usedKeys.add(baseId);
    // });
    // --- End other sources ---

    return usedKeys;
  }
}
