import * as path from "path";
import { Readable } from "stream";

import { Logger } from "@nestjs/common";

import { readLocalImageFile } from "./upload-seed-images.helper";
import { UploadService } from "../../common/upload/upload.service";
import { getErrorDetails } from "../../common/utils/error.util";

const logger = new Logger("ProcessSeedImagesHelper");

/**
 * Processes a seed image for a specific store using UploadService.
 * This ensures consistency with the new multi-size image system.
 * Creates multiple WebP versions and returns the base path.
 *
 * @param uploadService - Upload service instance
 * @param filename - Image filename (e.g., 'chicken-curry.jpg')
 * @param storeId - Store ID for folder organization
 * @returns Base S3 path (without version suffix), or null if processing failed
 */
export async function processSeedImage(
  uploadService: UploadService,
  filename: string,
  storeId: string,
): Promise<string | null> {
  try {
    // Read local seed image file
    const buffer = await readLocalImageFile(filename);
    if (!buffer) {
      logger.warn(
        `Cannot process seed image ${filename} - file not found locally`,
      );
      return null;
    }

    // Create a mock Express.Multer.File object
    const mockFile: Express.Multer.File = {
      fieldname: "image",
      originalname: filename,
      encoding: "7bit",
      mimetype:
        filename.endsWith(".jpg") || filename.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/png",
      buffer,
      size: buffer.length,
      stream: Readable.from(buffer),
      destination: "",
      filename: "",
      path: "",
    };

    // Use UploadService to process image (creates multiple WebP versions)
    const result = await uploadService.uploadImage(
      mockFile,
      "menu-item",
      storeId,
    );

    logger.log(
      `Processed seed image ${filename} for store ${storeId}: basePath=${result.basePath}`,
    );
    return result.basePath;
  } catch (error) {
    const { stack } = getErrorDetails(error);
    logger.error(
      `Failed to process seed image ${filename} for store ${storeId}`,
      stack,
    );
    return null;
  }
}

/**
 * Processes multiple seed images in parallel for a specific store.
 * Uses UploadService to create multi-size WebP versions for each image.
 *
 * @param uploadService - Upload service instance
 * @param filenames - Array of image filenames to process
 * @param storeId - Store ID for folder organization
 * @returns Map of filename (without extension) to base S3 path
 *
 * @example
 * const imageMap = await processSeedImagesInParallel(
 *   uploadService,
 *   ['chicken-curry.jpg', 'pizza.jpg'],
 *   'store-123'
 * );
 * // Returns: Map { 'chicken-curry' => 'uploads/abc-123', 'pizza' => 'uploads/def-456' }
 */
export async function processSeedImagesInParallel(
  uploadService: UploadService,
  filenames: string[],
  storeId: string,
): Promise<Map<string, string>> {
  const processPromises = filenames
    .filter((filename) => filename !== null)
    .map(async (filename) => {
      const basePath = await processSeedImage(uploadService, filename, storeId);
      const baseFilename = path.basename(filename, path.extname(filename));
      return { baseFilename, basePath };
    });

  const results = await Promise.all(processPromises);

  // Build map of filename -> base path (excluding failed uploads)
  const imageMap = new Map<string, string>();
  for (const { baseFilename, basePath } of results) {
    if (basePath) {
      imageMap.set(baseFilename, basePath);
    }
  }

  logger.log(
    `Processed ${imageMap.size}/${filenames.length} seed images for store ${storeId}`,
  );

  return imageMap;
}
