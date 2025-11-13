import { Logger } from "@nestjs/common";

import { getMimeType, readLocalImageFile } from "./upload-seed-images.helper";
import { S3Service } from "../../common/infra/s3.service";

const logger = new Logger("EnsureSeedImagesHelper");

/**
 * Shared S3 prefix for seed images (uploaded once, copied many times)
 */
export const SEED_IMAGES_S3_PREFIX = "menu-images/seed/";

/**
 * In-memory cache to track if seed images have been uploaded in this process
 * Prevents redundant S3 existence checks during application runtime
 */
let seedImagesInitialized = false;

/**
 * Checks if a specific seed image exists in S3 shared location
 * @param s3Service - S3 service instance
 * @param filename - Image filename (e.g., 'chicken-curry.jpg')
 * @returns true if image exists in S3, false otherwise
 */
export async function checkSeedImageExists(
  s3Service: S3Service,
  filename: string,
): Promise<boolean> {
  try {
    const key = `${SEED_IMAGES_S3_PREFIX}${filename}`;
    const allKeys = await s3Service.listAllObjectKeys(SEED_IMAGES_S3_PREFIX);
    return allKeys.includes(key);
  } catch (error) {
    logger.error(
      `Failed to check existence of seed image: ${filename}`,
      error.stack,
    );
    return false;
  }
}

/**
 * Uploads a single seed image to shared S3 location
 * @param s3Service - S3 service instance
 * @param filename - Image filename (e.g., 'chicken-curry.jpg')
 * @returns S3 URL if successful, null otherwise
 */
export async function uploadSeedImageToSharedLocation(
  s3Service: S3Service,
  filename: string,
): Promise<string | null> {
  try {
    // Read local image file
    const buffer = await readLocalImageFile(filename);
    if (!buffer) {
      logger.warn(
        `Cannot upload seed image ${filename} - file not found locally`,
      );
      return null;
    }

    // Determine MIME type
    const contentType = getMimeType(filename);

    // Upload to shared location (no timestamp, no storeId)
    const s3Key = `${SEED_IMAGES_S3_PREFIX}${filename}`;
    const s3Url = await s3Service.uploadFile(s3Key, buffer, contentType);

    logger.log(
      `Uploaded seed image to shared location: ${filename} -> ${s3Url}`,
    );
    return s3Url;
  } catch (error) {
    logger.error(
      `Failed to upload seed image to shared location: ${filename}`,
      error.stack,
    );
    return null;
  }
}

/**
 * Ensures all required seed images are available in S3 shared location.
 * Uploads missing images from local filesystem.
 * Uses in-memory cache to avoid redundant checks during application runtime.
 *
 * @param s3Service - S3 service instance
 * @param filenames - Array of required seed image filenames
 * @returns Object with upload results
 *
 * @example
 * const result = await ensureSeedImagesExist(s3Service, [
 *   'chicken-curry.jpg',
 *   'pizza.jpg',
 * ]);
 * // Returns: {
 * //   alreadyExisted: ['chicken-curry.jpg'],
 * //   uploaded: ['pizza.jpg'],
 * //   failed: []
 * // }
 */
export async function ensureSeedImagesExist(
  s3Service: S3Service,
  filenames: string[],
): Promise<{
  alreadyExisted: string[];
  uploaded: string[];
  failed: string[];
}> {
  // If already initialized in this process, skip checks
  if (seedImagesInitialized) {
    logger.verbose("Seed images already initialized in this process, skipping");
    return {
      alreadyExisted: filenames,
      uploaded: [],
      failed: [],
    };
  }

  logger.log(
    `Ensuring ${filenames.length} seed images exist in S3 shared location`,
  );

  const results = {
    alreadyExisted: [] as string[],
    uploaded: [] as string[],
    failed: [] as string[],
  };

  // Check and upload each image
  for (const filename of filenames) {
    const exists = await checkSeedImageExists(s3Service, filename);

    if (exists) {
      results.alreadyExisted.push(filename);
      logger.verbose(`Seed image already exists: ${filename}`);
    } else {
      logger.log(`Uploading missing seed image: ${filename}`);
      const s3Url = await uploadSeedImageToSharedLocation(s3Service, filename);

      if (s3Url) {
        results.uploaded.push(filename);
      } else {
        results.failed.push(filename);
      }
    }
  }

  // Mark as initialized if all succeeded
  if (results.failed.length === 0) {
    seedImagesInitialized = true;
    logger.log("All seed images successfully initialized in S3");
  } else {
    logger.warn(
      `Some seed images failed to initialize: ${results.failed.join(", ")}`,
    );
  }

  logger.log(
    `Seed image initialization complete: ${results.alreadyExisted.length} existed, ${results.uploaded.length} uploaded, ${results.failed.length} failed`,
  );

  return results;
}

/**
 * Resets the in-memory cache for seed images initialization.
 * Useful for testing or forcing re-initialization.
 */
export function resetSeedImagesCache(): void {
  seedImagesInitialized = false;
  logger.verbose("Seed images cache reset");
}
