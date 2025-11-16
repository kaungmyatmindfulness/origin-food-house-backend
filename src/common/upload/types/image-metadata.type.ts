import { ImageSizeVersion } from "./image-size-config.type";

/**
 * Metadata for a single image version.
 */
export interface VersionMetadata {
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** File size in bytes */
  size?: number;
}

/**
 * Metadata extracted from uploaded images.
 * Provides detailed information about image dimensions, format, and file size.
 */
export interface ImageMetadata {
  /** Original image width in pixels */
  originalWidth?: number;
  /** Original image height in pixels */
  originalHeight?: number;
  /** Image format (e.g., 'jpeg', 'png', 'webp', 'pdf') */
  format?: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Whether the image has transparency (alpha channel) */
  hasAlpha?: boolean;
  /** Color space of the image (e.g., 'srgb', 'cmyk') */
  space?: string;
  /** Generated versions with their metadata */
  versions: Partial<Record<ImageSizeVersion, VersionMetadata>>;
}

/**
 * Response payload for image upload operations.
 * Contains the base image path and available sizes for frontend URL construction.
 */
export interface ImageUploadResult {
  /** Base S3 path without version suffix (e.g., "uploads/abc-123-def") */
  readonly basePath: string;
  /** Available image sizes generated for this upload */
  readonly availableSizes: ImageSizeVersion[];
  /** Primary/default size for this preset (e.g., "medium", "large") */
  readonly primarySize: ImageSizeVersion;
  /** Metadata about the uploaded image and its generated versions */
  readonly metadata: ImageMetadata;
}
