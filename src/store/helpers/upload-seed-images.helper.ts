import { promises as fs } from "fs";
import * as path from "path";

import { Logger } from "@nestjs/common";

import { S3Service } from "../../common/infra/s3.service";
import { getErrorDetails } from "../../common/utils/error.util";

const logger = new Logger("UploadSeedImagesHelper");

/**
 * Path to seed images directory relative to project root
 */
const SEED_IMAGES_DIR = path.join(
  process.cwd(),
  "assets",
  "images",
  "seed",
  "menu",
);

/**
 * Reads a local image file from the filesystem
 * @param filename - Image filename (e.g., 'chicken-curry.jpg')
 * @returns Buffer containing the image data
 */
export async function readLocalImageFile(
  filename: string,
): Promise<Buffer | null> {
  try {
    const imagePath = path.join(SEED_IMAGES_DIR, filename);
    const buffer = await fs.readFile(imagePath);
    logger.log(`Read local image: ${filename} (${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    const { stack } = getErrorDetails(error);
    logger.error(`Failed to read local image: ${filename}`, stack);
    return null;
  }
}

/**
 * Determines MIME type from file extension
 * @param filename - Filename with extension
 * @returns MIME type string
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  return mimeTypeMap[ext] || "application/octet-stream";
}

/**
 * Uploads a seed image from local filesystem to S3
 * @param s3Service - S3 service instance
 * @param filename - Image filename (e.g., 'chicken-curry.jpg')
 * @param storeId - Store ID for folder organization
 * @returns S3 URL of uploaded image, or null if upload failed
 */
export async function uploadSeedImage(
  s3Service: S3Service,
  filename: string,
  storeId: string,
): Promise<string | null> {
  try {
    // Read local image file
    const buffer = await readLocalImageFile(filename);
    if (!buffer) {
      logger.warn(
        `Skipping upload for ${filename} - file not found or unreadable`,
      );
      return null;
    }

    // Determine MIME type
    const contentType = getMimeType(filename);

    // Generate unique S3 key
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `menu-images/${storeId}/${timestamp}-${sanitizedFilename}`;

    // Upload to S3
    const s3Url = await s3Service.uploadFile(s3Key, buffer, contentType);

    logger.log(`Uploaded seed image: ${filename} -> ${s3Url}`);
    return s3Url;
  } catch (error) {
    const { stack } = getErrorDetails(error);
    logger.error(`Failed to upload seed image: ${filename}`, stack);
    return null;
  }
}

/**
 * Uploads multiple seed images to S3 in parallel
 * @param s3Service - S3 service instance
 * @param filenames - Array of image filenames to upload
 * @param storeId - Store ID for folder organization
 * @returns Map of filename (without extension) to S3 URL
 *
 * @example
 * const imageMap = await uploadSeedImagesInParallel(
 *   s3Service,
 *   ['chicken-curry.jpg', 'pizza.jpg'],
 *   'store-123'
 * );
 * // Returns: Map { 'chicken-curry' => 'https://...', 'pizza' => 'https://...' }
 */
export async function uploadSeedImagesInParallel(
  s3Service: S3Service,
  filenames: string[],
  storeId: string,
): Promise<Map<string, string>> {
  const uploadPromises = filenames
    .filter((filename) => filename !== null)
    .map(async (filename) => {
      const s3Url = await uploadSeedImage(s3Service, filename, storeId);
      const baseFilename = path.basename(filename, path.extname(filename));
      return { baseFilename, s3Url };
    });

  const results = await Promise.all(uploadPromises);

  // Build map of filename -> S3 URL (excluding failed uploads)
  const imageMap = new Map<string, string>();
  for (const { baseFilename, s3Url } of results) {
    if (s3Url) {
      imageMap.set(baseFilename, s3Url);
    }
  }

  logger.log(
    `Uploaded ${imageMap.size}/${filenames.length} seed images for store ${storeId}`,
  );

  return imageMap;
}
