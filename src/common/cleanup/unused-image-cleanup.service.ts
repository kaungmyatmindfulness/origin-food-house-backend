import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3Service } from '../infra/s3.service';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class UnusedImageCleanupService {
  private readonly logger = new Logger(UnusedImageCleanupService.name);

  constructor(
    private s3Service: S3Service,
    private prisma: PrismaService, // DB service
  ) {}

  /**
   * Runs every Sunday at midnight ("0 0 * * 0").
   * Lists all S3 object keys in the bucket, collects base keys from the DB,
   * and deletes any leftover objects that don't start with a known base key.
   */
  @Cron('0 0 * * 0')
  async handleCleanupUnusedImages() {
    this.logger.log('Running weekly cleanup of unused images...');

    // 1) List all objects in S3 with prefix "uploads/" (if that's where images are stored)
    const allS3Keys = await this.s3Service.listAllObjects('uploads/');

    // 2) Gather the base keys from the DB. E.g., from "MenuItem" if you store "imageKey"
    //    (the "base" part without -original, -medium, -thumb).
    const menuItemImages = await this.prisma.menuItem.findMany({
      select: { imageKey: true },
    });

    // Convert them to a set for easy iteration
    const usedBaseKeys = new Set<string>();
    for (const item of menuItemImages) {
      if (item.imageKey) {
        usedBaseKeys.add(item.imageKey);
      }
    }

    // 3) Filter out S3 objects that do *not* start with any used base key
    const unusedKeys = allS3Keys.filter((key) => {
      // If "key" starts with one of the used base keys, it's considered used
      let isUsed = false;
      for (const baseKey of usedBaseKeys) {
        // e.g., if baseKey = 'uploads/81eaa567-...'
        // then keys like 'uploads/81eaa567-...-original' are used
        if (key.startsWith(baseKey)) {
          isUsed = true;
          break;
        }
      }
      return !isUsed;
    });

    if (unusedKeys.length === 0) {
      this.logger.log('No unused images found. Cleanup done.');
      return;
    }

    // 4) Delete them from S3
    let deletedCount = 0;
    for (const key of unusedKeys) {
      try {
        await this.s3Service.deleteFile(key);
        this.logger.log(`Deleted unused image with key=${key}`);
        deletedCount++;
      } catch (err) {
        this.logger.error(`Failed to delete key=${key}`, err);
      }
    }

    this.logger.log(`Cleanup done. Removed ${deletedCount} images.`);
  }
}
