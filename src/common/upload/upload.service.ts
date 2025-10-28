import * as path from "path";

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import * as sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import { S3Service } from "../infra/s3.service";

const IMAGE_UPLOAD_PREFIX = "uploads/";
const IMAGE_SUFFIX_MEDIUM = "medium";
const IMAGE_SUFFIX_THUMB = "thumb";
const IMAGE_WIDTH_MEDIUM = 800;
const IMAGE_WIDTH_THUMB = 200;
const RESIZED_IMAGE_EXTENSION = ".webp";
const RESIZED_IMAGE_CONTENT_TYPE = "image/webp";
const SHARP_RESIZE_OPTIONS: sharp.ResizeOptions = {
  fit: "inside",
  withoutEnlargement: true,
};

const SHARP_OUTPUT_OPTIONS: sharp.WebpOptions = { quality: 80 };

const ALLOWED_MIME_TYPES = /image\/(jpeg|jpg|png|webp)/;
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Uploads an image file, validates it, generates webp medium and thumb versions,
   * and uploads them to S3. Cleans up uploaded files if any step fails.
   *
   * @param file The image file uploaded via Multer.
   * @returns The full public URL of the generated medium-sized WebP image.
   * @throws {BadRequestException} If the file is missing, invalid, or too small.
   * @throws {InternalServerErrorException} On processing or S3 upload errors.
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    // Return type is still string (URL)
    this.validateFileAndGetExtension(file);
    const originalBuffer = file.buffer;
    const uniqueId = uuidv4();
    const baseKeyWithoutExt = `${IMAGE_UPLOAD_PREFIX}${uniqueId}`;

    this.logger.log(
      `Processing image upload. Base key: ${baseKeyWithoutExt}. Output versions will be WebP.`,
    );

    const uploadedKeys: string[] = [];
    let mediumVersionGenerated = false; // Flag to check if medium was created

    try {
      const processingPromises: Promise<void>[] = [];
      const metadata = await sharp(originalBuffer).metadata();
      const originalWidth = metadata.width;

      this.logger.debug(
        `Original image metadata for ${baseKeyWithoutExt}: width=${originalWidth}, height=${metadata.height}`,
      );

      if (!originalWidth) {
        this.logger.error("Original width is not defined.");
        throw new BadRequestException("Image width is required.");
      }

      // 1. Process and Upload Medium (as WebP) - Conditional
      const mediumTargetWidth = Math.min(originalWidth, IMAGE_WIDTH_MEDIUM);
      // Only generate medium if calculated target width is meaningful (e.g., > 0)
      // And also check if original wasn't already tiny (maybe add a min width check?)
      // For simplicity, we generate if target width > 0, Sharp handles small inputs.
      if (mediumTargetWidth > 0) {
        this.logger.log(
          `Determined target width for medium version of ${baseKeyWithoutExt}: ${mediumTargetWidth}px`,
        );
        processingPromises.push(
          this.uploadResizedWebpVersion(
            originalBuffer,
            baseKeyWithoutExt,
            IMAGE_SUFFIX_MEDIUM,
            mediumTargetWidth,
            uploadedKeys,
          ),
        );
        mediumVersionGenerated = true; // Mark medium as generated
      } else {
        this.logger.warn(
          `Skipping medium version generation for ${baseKeyWithoutExt} due to calculated target width ${mediumTargetWidth}px.`,
        );
      }

      // 2. Process and Upload Thumbnail (as WebP) - Conditional
      const thumbTargetWidth = Math.min(originalWidth, IMAGE_WIDTH_THUMB);
      if (thumbTargetWidth > 0) {
        this.logger.log(
          `Determined target width for thumb version of ${baseKeyWithoutExt}: ${thumbTargetWidth}px`,
        );
        processingPromises.push(
          this.uploadResizedWebpVersion(
            originalBuffer,
            baseKeyWithoutExt,
            IMAGE_SUFFIX_THUMB,
            thumbTargetWidth,
            uploadedKeys,
          ),
        );
      } else {
        this.logger.warn(
          `Skipping thumb version generation for ${baseKeyWithoutExt} due to calculated target width ${thumbTargetWidth}px.`,
        );
      }

      // Check if any versions were actually processed
      if (processingPromises.length === 0) {
        this.logger.warn(
          `No image versions generated for upload (possibly due to small input size) for base key ${baseKeyWithoutExt}.`,
        );
        throw new BadRequestException(
          "Image dimensions too small, no versions generated.",
        );
      }

      await Promise.all(processingPromises);

      this.logger.log(
        `Successfully processed and uploaded generated versions for base key: ${baseKeyWithoutExt}`,
      );

      // --- Construct and return the MEDIUM image URL ---
      if (!mediumVersionGenerated) {
        // This case should ideally not be hit if the check above works, but handle defensively
        this.logger.error(
          `Medium version was expected but not generated for ${baseKeyWithoutExt}. Cannot return URL.`,
        );
        throw new InternalServerErrorException(
          "Failed to generate medium image version.",
        );
        // Or alternatively, return the thumb URL if that's acceptable:
        // const thumbKey = `${baseKeyWithoutExt}-${IMAGE_SUFFIX_THUMB}${RESIZED_IMAGE_EXTENSION}`;
        // return this.s3Service.getObjectUrl(thumbKey);
      }

      const mediumKey = `${baseKeyWithoutExt}-${IMAGE_SUFFIX_MEDIUM}${RESIZED_IMAGE_EXTENSION}`;
      const mediumUrl = this.s3Service.getObjectUrl(mediumKey); // Use S3Service to build URL
      this.logger.log(`Returning medium image URL: ${mediumUrl}`);
      return mediumUrl;
      // -------------------------------------------------
    } catch (error) {
      this.logger.error(
        `Error processing image upload for base key ${baseKeyWithoutExt}`,
        error,
      );
      await this.deleteUploadedVersionsOnError(baseKeyWithoutExt, uploadedKeys);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        "Failed to process or upload image.",
      );
    }
  }

  /**
   * Validates the uploaded file and returns its extension (including the dot).
   * @throws {BadRequestException} if validation fails.
   */
  private validateFileAndGetExtension(file: Express.Multer.File): string {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);
    const isValidMimeType = ALLOWED_MIME_TYPES.test(file.mimetype);

    if (!isValidExtension || !isValidMimeType) {
      this.logger.warn(
        `Invalid file uploaded: name=${file.originalname}, type=${file.mimetype}, ext=${fileExtension}`,
      );
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}. Received: ${file.mimetype}`,
      );
    }

    this.logger.verbose(
      `File validation passed: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`,
    );
    return fileExtension;
  }

  /**
   * Helper to upload a specific buffer under a constructed key.
   * (Now only used internally by uploadResizedWebpVersion)
   */
  private async uploadVersion(
    buffer: Buffer,
    baseKeyWithoutExt: string,
    suffix: string,
    extension: string,
    contentType: string,
    uploadedKeysRef: string[],
  ): Promise<void> {
    const key = `${baseKeyWithoutExt}-${suffix}${extension}`;
    try {
      this.logger.verbose(
        `Uploading version: ${key}, ContentType: ${contentType}`,
      );
      await this.s3Service.uploadFile(key, buffer, contentType);
      uploadedKeysRef.push(key);
      this.logger.verbose(`Successfully uploaded version: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to upload version ${key}`, error);
      throw error;
    }
  }

  /**
   * Helper to resize to WebP format and upload using the *provided* target width.
   * Sharp's `withoutEnlargement` option still prevents upscaling beyond original dimensions if targetWidth > originalWidth.
   */
  private async uploadResizedWebpVersion(
    originalBuffer: Buffer,
    baseKeyWithoutExt: string,
    suffix: string,
    targetWidth: number,
    uploadedKeysRef: string[],
  ): Promise<void> {
    const keyWithoutExt = `${baseKeyWithoutExt}-${suffix}`;
    try {
      this.logger.verbose(
        `Resizing image for version: ${keyWithoutExt} to target width ${targetWidth}px (Output: WebP)`,
      );
      const resizedBuffer = await sharp(originalBuffer)
        .resize(targetWidth, null, SHARP_RESIZE_OPTIONS)
        .webp(SHARP_OUTPUT_OPTIONS)
        .toBuffer();

      this.logger.verbose(
        `Resized buffer size for ${keyWithoutExt}: ${resizedBuffer.byteLength}`,
      );

      await this.uploadVersion(
        resizedBuffer,
        baseKeyWithoutExt,
        suffix,
        RESIZED_IMAGE_EXTENSION,
        RESIZED_IMAGE_CONTENT_TYPE,
        uploadedKeysRef,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resize or upload WebP version ${keyWithoutExt}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Attempts cleanup of successfully uploaded files when an error occurs during processing.
   */
  private async deleteUploadedVersionsOnError(
    baseKeyWithoutExt: string,
    uploadedKeys: string[],
  ): Promise<void> {
    if (!uploadedKeys || uploadedKeys.length === 0) {
      this.logger.log(
        `No previously uploaded versions to clean up for base key: ${baseKeyWithoutExt}.`,
      );
      return;
    }
    this.logger.warn(
      `Attempting cleanup for base key: ${baseKeyWithoutExt}. Deleting successfully uploaded keys: ${uploadedKeys.join(", ")}`,
    );

    const deletePromises = uploadedKeys.map((key) =>
      this.s3Service.deleteFile(key).catch((err) => {
        this.logger.error(`Failed to delete cleanup file ${key}`, err);
      }),
    );

    try {
      await Promise.all(deletePromises);
      this.logger.warn(`Cleanup finished for base key: ${baseKeyWithoutExt}.`);
    } catch (error) {
      this.logger.error(
        `Unexpected error during cleanup promise resolution for ${baseKeyWithoutExt}`,
        error,
      );
    }
  }

  /**
   * Deletes generated versions of an image based on its base key (prefix + uuid).
   * @param baseKeyWithoutExt The base key (e.g., "uploads/uuid") without suffixes or extension.
   */
  async deleteImage(baseKeyWithoutExt: string): Promise<void> {
    this.logger.log(
      `Attempting to delete generated versions for base key: ${baseKeyWithoutExt}`,
    );

    if (!baseKeyWithoutExt?.startsWith(IMAGE_UPLOAD_PREFIX)) {
      this.logger.error(
        `Invalid baseKey format provided for deletion: ${baseKeyWithoutExt}`,
      );
      throw new BadRequestException(
        "Invalid image key format provided for deletion.",
      );
    }

    const keysToDelete = [
      `${baseKeyWithoutExt}-${IMAGE_SUFFIX_MEDIUM}${RESIZED_IMAGE_EXTENSION}`,
      `${baseKeyWithoutExt}-${IMAGE_SUFFIX_THUMB}${RESIZED_IMAGE_EXTENSION}`,
    ];

    this.logger.log(`Attempting to delete keys: ${keysToDelete.join(", ")}`);

    const deletePromises = keysToDelete.map((key) =>
      this.s3Service.deleteFile(key).catch((err) => {
        if (err instanceof NotFoundException) {
          this.logger.warn(`Attempted to delete non-existent version: ${key}`);
        } else {
          this.logger.error(`Failed to delete image version ${key}`, err);
        }
      }),
    );

    await Promise.all(deletePromises);
    this.logger.log(
      `Finished deletion attempt for base key: ${baseKeyWithoutExt}`,
    );
  }
}
