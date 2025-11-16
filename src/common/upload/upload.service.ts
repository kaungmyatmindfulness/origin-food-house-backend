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
import { ImageMetadata, ImageUploadResult } from "./types/image-metadata.type";
import {
  ImageSizePreset,
  IMAGE_SIZE_PRESETS,
  DEFAULT_IMAGE_SIZE_PRESET,
  ImageSizeConfig,
  ImageSizeVersion,
} from "./types/image-size-config.type";

const IMAGE_UPLOAD_PREFIX = "uploads/";
const RESIZED_IMAGE_EXTENSION = ".webp";
const RESIZED_IMAGE_CONTENT_TYPE = "image/webp";
const SHARP_RESIZE_OPTIONS: sharp.ResizeOptions = {
  fit: "inside",
  withoutEnlargement: true,
};

const SHARP_OUTPUT_OPTIONS: sharp.WebpOptions = { quality: 80 };

const ALLOWED_IMAGE_MIME_TYPES = /image\/(jpeg|jpg|png|webp)/;
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_DOCUMENT_MIME_TYPES = /application\/pdf/;
const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf"];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Uploads a file (image or document), validates it, and processes based on the preset.
   * For images: generates webp medium and thumb versions.
   * For documents (e.g., PDFs): uploads as-is without resizing.
   *
   * @param file The file uploaded via Multer.
   * @param preset The image size preset to use (defaults to 'menu-item').
   * @param storeId Optional store ID for store-specific prefixes (e.g., payment proofs).
   * @returns The upload result containing URL and metadata.
   * @throws {BadRequestException} If the file is missing, invalid, or too small.
   * @throws {InternalServerErrorException} On processing or S3 upload errors.
   */
  async uploadImage(
    file: Express.Multer.File,
    preset: ImageSizePreset = DEFAULT_IMAGE_SIZE_PRESET,
    storeId?: string,
  ): Promise<ImageUploadResult> {
    const config = this.getPresetConfig(preset);
    const isDocument = this.isDocumentFile(file);

    this.validateFile(file, config.skipResize ?? false);

    const uniqueId = uuidv4();
    const uploadPrefix = this.getUploadPrefix(config, storeId);
    const baseKeyWithoutExt = `${uploadPrefix}${uniqueId}`;

    this.logger.log(
      `[uploadImage] Processing file upload with preset '${preset}'. Base key: ${baseKeyWithoutExt}`,
    );

    // Handle document upload (no resizing)
    if (config.skipResize || isDocument) {
      return await this.uploadDocumentWithoutResize(
        file,
        baseKeyWithoutExt,
        preset,
      );
    }

    // Handle image upload with resizing
    return await this.uploadImageWithResize(
      file,
      baseKeyWithoutExt,
      config,
      preset,
    );
  }

  /**
   * Uploads a document file without any resizing or transformation.
   * @param file The document file to upload.
   * @param baseKeyWithoutExt The S3 key prefix.
   * @param preset The preset name (for logging).
   * @returns Upload result with original file URL and metadata.
   */
  private async uploadDocumentWithoutResize(
    file: Express.Multer.File,
    baseKeyWithoutExt: string,
    preset: ImageSizePreset,
  ): Promise<ImageUploadResult> {
    const method = "uploadDocumentWithoutResize";
    this.logger.log(
      `[${method}] Uploading document without resizing (preset: ${preset})`,
    );

    const extension = path.extname(file.originalname).toLowerCase();
    const key = `${baseKeyWithoutExt}-original${extension}`;

    try {
      await this.s3Service.uploadFile(key, file.buffer, file.mimetype);

      this.logger.log(`[${method}] Document uploaded successfully to: ${key}`);

      const metadata: ImageMetadata = {
        originalSize: file.size,
        format: extension.replace(".", ""),
        versions: {
          original: {
            size: file.buffer.byteLength,
          },
        },
      };

      return {
        basePath: baseKeyWithoutExt,
        availableSizes: ["original"],
        primarySize: "original",
        metadata,
      };
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to upload document ${baseKeyWithoutExt}`,
        error,
      );
      throw new InternalServerErrorException("Failed to upload document.");
    }
  }

  /**
   * Uploads an image file with resizing to multiple versions (original, small, medium, large).
   * @param file The image file to upload.
   * @param baseKeyWithoutExt The S3 key prefix.
   * @param config Size configuration for this upload.
   * @param preset The preset name (for logging).
   * @returns Upload result with primary version URL and all generated versions.
   */
  private async uploadImageWithResize(
    file: Express.Multer.File,
    baseKeyWithoutExt: string,
    config: ImageSizeConfig,
    preset: ImageSizePreset,
  ): Promise<ImageUploadResult> {
    const method = "uploadImageWithResize";
    const originalBuffer = file.buffer;
    const uploadedKeys: string[] = [];

    this.logger.log(
      `[${method}] Processing image with preset '${preset}' - generating multiple versions`,
    );

    try {
      const sharpMetadata = await sharp(originalBuffer).metadata();
      const originalWidth = sharpMetadata.width;
      const originalHeight = sharpMetadata.height;

      this.logger.debug(
        `[${method}] Original image metadata: width=${originalWidth}, height=${originalHeight}, format=${sharpMetadata.format}`,
      );

      if (!originalWidth) {
        this.logger.error(`[${method}] Original width is not defined.`);
        throw new BadRequestException("Image width is required.");
      }

      // Initialize metadata
      const metadata: ImageMetadata = {
        originalWidth,
        originalHeight,
        format: sharpMetadata.format,
        originalSize: file.size,
        hasAlpha: sharpMetadata.hasAlpha,
        space: sharpMetadata.space,
        versions: {},
      };

      const availableSizes: ImageSizeVersion[] = [];
      const processingPromises: Promise<void>[] = [];

      // Process each version defined in the config
      for (const [versionName, versionConfig] of Object.entries(
        config.versions,
      ) as [ImageSizeVersion, (typeof config.versions)[ImageSizeVersion]][]) {
        if (!versionConfig) continue;

        this.logger.log(
          `[${method}] Generating '${versionName}' version (${versionConfig.width ?? "original"}px)`,
        );

        processingPromises.push(
          this.processAndUploadVersion(
            originalBuffer,
            baseKeyWithoutExt,
            versionName,
            versionConfig,
            originalWidth,
            uploadedKeys,
            metadata,
            availableSizes,
          ),
        );
      }

      if (processingPromises.length === 0) {
        this.logger.warn(
          `[${method}] No versions configured for preset '${preset}'`,
        );
        throw new BadRequestException(
          "No image versions configured for this preset.",
        );
      }

      await Promise.all(processingPromises);

      this.logger.log(
        `[${method}] Successfully processed and uploaded ${availableSizes.length} versions`,
      );

      // Determine primary version
      const primarySize = config.primaryVersion ?? "medium";

      if (!availableSizes.includes(primarySize)) {
        this.logger.error(
          `[${method}] Primary size '${primarySize}' was not generated`,
        );
        // Fallback to first available size
        const fallbackSize = availableSizes[0];
        if (!fallbackSize) {
          throw new InternalServerErrorException(
            "Failed to generate any image versions.",
          );
        }
        this.logger.warn(`[${method}] Using fallback size: ${fallbackSize}`);
        return {
          basePath: baseKeyWithoutExt,
          availableSizes,
          primarySize: fallbackSize,
          metadata,
        };
      }

      this.logger.log(
        `[${method}] Returning base path with ${availableSizes.length} sizes (primary: ${primarySize})`,
      );
      return {
        basePath: baseKeyWithoutExt,
        availableSizes,
        primarySize,
        metadata,
      };
    } catch (error) {
      this.logger.error(
        `[${method}] Error processing image upload for base key ${baseKeyWithoutExt}`,
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
   * Processes and uploads a single image version.
   */
  private async processAndUploadVersion(
    originalBuffer: Buffer,
    baseKeyWithoutExt: string,
    versionName: ImageSizeVersion,
    versionConfig: { width: number | null; suffix: string },
    originalWidth: number,
    uploadedKeysRef: string[],
    metadata: ImageMetadata,
    availableSizes: ImageSizeVersion[],
  ): Promise<void> {
    const method = "processAndUploadVersion";

    try {
      let processedBuffer: Buffer;
      let info: sharp.OutputInfo | null = null;

      // Handle original (no resize)
      if (versionConfig.width === null) {
        this.logger.verbose(
          `[${method}] Keeping original size for '${versionName}'`,
        );
        processedBuffer = originalBuffer;
      } else {
        // Resize to target width
        const targetWidth = Math.min(originalWidth, versionConfig.width);

        const { data, info: resizeInfo } = await sharp(originalBuffer)
          .resize(targetWidth, null, SHARP_RESIZE_OPTIONS)
          .webp(SHARP_OUTPUT_OPTIONS)
          .toBuffer({ resolveWithObject: true });

        processedBuffer = data;
        info = resizeInfo;

        this.logger.verbose(
          `[${method}] Resized '${versionName}' to ${info.width}x${info.height} (${processedBuffer.byteLength} bytes)`,
        );
      }

      // Upload to S3
      const extension =
        versionConfig.width === null
          ? path.extname(baseKeyWithoutExt) || ".webp"
          : RESIZED_IMAGE_EXTENSION;
      const key = `${baseKeyWithoutExt}-${versionConfig.suffix}${extension}`;
      const contentType =
        versionConfig.width === null
          ? "image/jpeg"
          : RESIZED_IMAGE_CONTENT_TYPE;

      await this.s3Service.uploadFile(key, processedBuffer, contentType);
      uploadedKeysRef.push(key);

      // Add to available sizes array
      availableSizes.push(versionName);

      // Store version metadata (without URL)
      metadata.versions[versionName] = {
        width: info?.width ?? originalWidth,
        height: info?.height,
        size: processedBuffer.byteLength,
      };

      this.logger.verbose(
        `[${method}] Uploaded '${versionName}' version to S3 key: ${key}`,
      );
    } catch (error) {
      this.logger.error(
        `[${method}] Failed to process '${versionName}' version`,
        error,
      );
      throw error;
    }
  }

  /**
   * Gets the size configuration for a given preset.
   * @param preset The size preset name.
   * @returns The configuration for that preset.
   * @throws {BadRequestException} if the preset is invalid.
   */
  private getPresetConfig(preset: ImageSizePreset): ImageSizeConfig {
    const config = IMAGE_SIZE_PRESETS[preset];
    if (!config) {
      throw new BadRequestException(
        `Invalid image size preset: ${preset}. Allowed: ${Object.keys(IMAGE_SIZE_PRESETS).join(", ")}`,
      );
    }
    return config;
  }

  /**
   * Determines if the uploaded file is a document (not an image).
   * @param file The uploaded file.
   * @returns True if the file is a document (PDF), false otherwise.
   */
  private isDocumentFile(file: Express.Multer.File): boolean {
    const extension = path.extname(file.originalname).toLowerCase();
    return (
      ALLOWED_DOCUMENT_EXTENSIONS.includes(extension) ||
      ALLOWED_DOCUMENT_MIME_TYPES.test(file.mimetype)
    );
  }

  /**
   * Gets the S3 upload prefix based on configuration.
   * @param config The size configuration.
   * @param storeId Optional store ID for store-specific prefixes.
   * @returns The S3 key prefix.
   */
  private getUploadPrefix(config: ImageSizeConfig, storeId?: string): string {
    if (config.s3Prefix) {
      // For payment proofs and other store-specific uploads
      return storeId ? `${config.s3Prefix}${storeId}/` : config.s3Prefix;
    }
    return IMAGE_UPLOAD_PREFIX;
  }

  /**
   * Validates the uploaded file.
   * @param file The uploaded file.
   * @param allowDocuments Whether to allow document files (PDFs).
   * @throws {BadRequestException} if validation fails.
   */
  private validateFile(
    file: Express.Multer.File,
    allowDocuments: boolean,
  ): void {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    const fileExtension = path.extname(file.originalname).toLowerCase();
    const isImage =
      ALLOWED_IMAGE_EXTENSIONS.includes(fileExtension) &&
      ALLOWED_IMAGE_MIME_TYPES.test(file.mimetype);
    const isDocument =
      allowDocuments &&
      ALLOWED_DOCUMENT_EXTENSIONS.includes(fileExtension) &&
      ALLOWED_DOCUMENT_MIME_TYPES.test(file.mimetype);

    if (!isImage && !isDocument) {
      const allowedTypes = allowDocuments
        ? [...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_DOCUMENT_EXTENSIONS]
        : ALLOWED_IMAGE_EXTENSIONS;

      this.logger.warn(
        `Invalid file uploaded: name=${file.originalname}, type=${file.mimetype}, ext=${fileExtension}`,
      );
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}. Received: ${file.mimetype}`,
      );
    }

    this.logger.verbose(
      `File validation passed: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`,
    );
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

    // Generate all possible version keys
    const versionSuffixes = ["original", "small", "medium", "large"];
    const keysToDelete = versionSuffixes.map(
      (suffix) => `${baseKeyWithoutExt}-${suffix}${RESIZED_IMAGE_EXTENSION}`,
    );

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
