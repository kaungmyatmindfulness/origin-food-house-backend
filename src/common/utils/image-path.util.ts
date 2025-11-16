import { ImageSizeVersion } from "../upload/types/image-size-config.type";

/**
 * Extracts the base path from a versioned image path.
 * Removes version suffix and extension.
 *
 * @param versionPath Full path with version (e.g., "uploads/uuid-medium.webp")
 * @returns Base path without version (e.g., "uploads/uuid")
 * @throws {TypeError} If versionPath is not a string
 * @throws {Error} If versionPath doesn't contain a valid version suffix
 *
 * @example
 * getBasePathFromVersionPath("uploads/abc-123-medium.webp") // "uploads/abc-123"
 * getBasePathFromVersionPath("payment-proofs/store123/uuid-original.pdf") // "payment-proofs/store123/uuid"
 */
export function getBasePathFromVersionPath(versionPath: string): string {
  if (!versionPath || typeof versionPath !== "string") {
    throw new TypeError("versionPath must be a non-empty string");
  }

  const versionPattern = /-(original|small|medium|large)\.\w+$/;

  // Check if the path contains a version suffix
  if (!versionPattern.test(versionPath)) {
    throw new Error(
      `Invalid version path format: "${versionPath}". Expected path with version suffix like "uploads/uuid-medium.webp"`,
    );
  }

  // Remove version suffix and extension
  return versionPath.replace(versionPattern, "");
}

/**
 * Constructs a versioned path from a base path and size.
 *
 * @param basePath Base S3 path (e.g., "uploads/uuid")
 * @param size Image size version
 * @param extension File extension (defaults to '.webp')
 * @returns Full path with version suffix (e.g., "uploads/uuid-medium.webp")
 * @throws {TypeError} If basePath or size is not a string
 * @throws {Error} If basePath already contains a version suffix
 *
 * @example
 * getVersionPath("uploads/abc-123", "medium") // "uploads/abc-123-medium.webp"
 * getVersionPath("payment-proofs/store/uuid", "original", ".pdf") // "payment-proofs/store/uuid-original.pdf"
 */
export function getVersionPath(
  basePath: string,
  size: ImageSizeVersion,
  extension: string = ".webp",
): string {
  if (!basePath || typeof basePath !== "string") {
    throw new TypeError("basePath must be a non-empty string");
  }

  if (!size || typeof size !== "string") {
    throw new TypeError("size must be a non-empty string");
  }

  // Ensure basePath doesn't already contain a version suffix
  if (/-(original|small|medium|large)$/.test(basePath)) {
    throw new Error(
      `Base path "${basePath}" already contains a version suffix. Remove it before calling getVersionPath.`,
    );
  }

  return `${basePath}-${size}${extension}`;
}

/**
 * Validates if a string is a valid image base path.
 *
 * @param path Path to validate
 * @returns True if valid base path format, false otherwise
 *
 * @example
 * isValidImagePath("uploads/abc-123-def") // true
 * isValidImagePath("payment-proofs/store123/uuid") // true
 * isValidImagePath("invalid/path with spaces") // false
 * isValidImagePath("https://example.com/image.jpg") // false
 */
export function isValidImagePath(path: string): boolean {
  // Return false for null, undefined, or non-string values
  if (!path || typeof path !== "string") {
    return false;
  }

  // Must start with uploads/ or payment-proofs/
  // Must contain only alphanumeric, hyphens, slashes
  // Must NOT contain spaces or special characters
  // Must NOT contain version suffixes
  // Must NOT be a full URL
  const validPattern = /^(uploads|payment-proofs)\/[a-zA-Z0-9/-]+$/;

  if (!validPattern.test(path)) {
    return false;
  }

  // Should not end with version suffix
  if (/-(original|small|medium|large)$/.test(path)) {
    return false;
  }

  // Explicitly reject paths containing spaces
  if (/\s/.test(path)) {
    return false;
  }

  return true;
}

/**
 * Extracts base path from a full S3 URL.
 * Useful for migration from old URL-based system.
 *
 * @param url Full S3 URL
 * @returns Base path without version suffix
 *
 * @example
 * extractBasePathFromUrl("https://bucket.s3.region.amazonaws.com/uploads/uuid-medium.webp")
 * // Returns: "uploads/uuid"
 */
export function extractBasePathFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    // Get pathname, remove leading "/"
    const pathname = parsedUrl.pathname.substring(1);
    // Remove version suffix and extension
    return getBasePathFromVersionPath(pathname);
  } catch {
    return null;
  }
}
