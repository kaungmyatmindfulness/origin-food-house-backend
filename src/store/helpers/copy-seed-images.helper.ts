import * as path from "path";

import { Logger } from "@nestjs/common";

import { SEED_IMAGES_S3_PREFIX } from "./ensure-seed-images.helper";
import { S3Service } from "../../common/infra/s3.service";
import { getErrorDetails } from "../../common/utils/error.util";

const logger = new Logger("CopySeedImagesHelper");

/**
 * Copies a seed image from shared S3 location to store-specific location
 * @param s3Service - S3 service instance
 * @param filename - Image filename (e.g., 'chicken-curry.jpg')
 * @param storeId - Store ID for folder organization
 * @returns S3 URL of copied image, or null if copy failed
 */
export async function copySeedImage(
  s3Service: S3Service,
  filename: string,
  storeId: string,
): Promise<string | null> {
  try {
    // Source: shared seed location
    const sourceKey = `${SEED_IMAGES_S3_PREFIX}${filename}`;

    // Destination: store-specific location with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const destinationKey = `menu-images/${storeId}/${timestamp}-${sanitizedFilename}`;

    // Perform server-side copy (fast, no bandwidth)
    const s3Url = await s3Service.copyFile(sourceKey, destinationKey);

    logger.log(
      `Copied seed image for store ${storeId}: ${filename} -> ${destinationKey}`,
    );
    return s3Url;
  } catch (error) {
    const { stack } = getErrorDetails(error);
    logger.error(
      `Failed to copy seed image ${filename} for store ${storeId}`,
      stack,
    );
    return null;
  }
}

/**
 * Copies multiple seed images to S3 in parallel for a specific store.
 * Uses S3 server-side copy operation (much faster than uploading).
 *
 * @param s3Service - S3 service instance
 * @param filenames - Array of image filenames to copy
 * @param storeId - Store ID for folder organization
 * @returns Map of filename (without extension) to S3 URL
 *
 * @example
 * const imageMap = await copySeedImagesInParallel(
 *   s3Service,
 *   ['chicken-curry.jpg', 'pizza.jpg'],
 *   'store-123'
 * );
 * // Returns: Map { 'chicken-curry' => 'https://...', 'pizza' => 'https://...' }
 */
export async function copySeedImagesInParallel(
  s3Service: S3Service,
  filenames: string[],
  storeId: string,
): Promise<Map<string, string>> {
  const copyPromises = filenames
    .filter((filename) => filename !== null)
    .map(async (filename) => {
      const s3Url = await copySeedImage(s3Service, filename, storeId);
      const baseFilename = path.basename(filename, path.extname(filename));
      return { baseFilename, s3Url };
    });

  const results = await Promise.all(copyPromises);

  // Build map of filename -> S3 URL (excluding failed copies)
  const imageMap = new Map<string, string>();
  for (const { baseFilename, s3Url } of results) {
    if (s3Url) {
      imageMap.set(baseFilename, s3Url);
    }
  }

  logger.log(
    `Copied ${imageMap.size}/${filenames.length} seed images for store ${storeId}`,
  );

  return imageMap;
}
