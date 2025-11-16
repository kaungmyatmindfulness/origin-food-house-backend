/**
 * Standard image size version names.
 */
export type ImageSizeVersion = "original" | "small" | "medium" | "large";

/**
 * Configuration for a single image version.
 */
export interface ImageVersionConfig {
  /** Target width in pixels (null for original) */
  readonly width: number | null;
  /** Suffix for the file name (e.g., '-small', '-medium') */
  readonly suffix: string;
}

/**
 * Configuration for image size presets.
 * Defines which versions to generate and their dimensions.
 */
export interface ImageSizeConfig {
  /** Versions to generate for this preset */
  readonly versions: Record<ImageSizeVersion, ImageVersionConfig | null>;
  /** Whether to skip resizing entirely (for documents like PDFs) */
  readonly skipResize?: boolean;
  /** S3 prefix for this image type (if different from default) */
  readonly s3Prefix?: string;
  /** Primary version to return in imageUrl field */
  readonly primaryVersion?: ImageSizeVersion;
}

/**
 * Preset type for different image use cases across the application.
 */
export type ImageSizePreset =
  | "menu-item"
  | "store-logo"
  | "cover-photo"
  | "payment-proof";

/**
 * Standard version configurations.
 * These define the dimensions for each size tier.
 */
export const STANDARD_VERSIONS: Record<ImageSizeVersion, ImageVersionConfig> = {
  original: {
    width: null, // Original size, no resizing
    suffix: "original",
  },
  small: {
    width: 400,
    suffix: "small",
  },
  medium: {
    width: 800,
    suffix: "medium",
  },
  large: {
    width: 1200,
    suffix: "large",
  },
};

/**
 * Predefined size configurations for different image types.
 * Each preset optimizes image dimensions for its specific use case.
 */
export const IMAGE_SIZE_PRESETS: Record<ImageSizePreset, ImageSizeConfig> = {
  /**
   * Menu item images - generate small, medium, and large versions
   * Used in: Menu items, category displays
   * Primary: medium (for backward compatibility)
   */
  "menu-item": {
    versions: {
      original: null, // Don't keep original
      small: STANDARD_VERSIONS.small,
      medium: STANDARD_VERSIONS.medium,
      large: STANDARD_VERSIONS.large,
    },
    primaryVersion: "medium",
  },

  /**
   * Store logos - smaller dimensions, generate small and medium only
   * Used in: Store information, navigation, branding
   * Primary: medium
   */
  "store-logo": {
    versions: {
      original: null,
      small: { width: 200, suffix: "small" },
      medium: { width: 400, suffix: "medium" },
      large: null, // Don't generate large for logos
    },
    primaryVersion: "medium",
  },

  /**
   * Cover/banner photos - all sizes including large
   * Used in: Store pages, promotional banners
   * Primary: large
   */
  "cover-photo": {
    versions: {
      original: null,
      small: STANDARD_VERSIONS.small,
      medium: STANDARD_VERSIONS.medium,
      large: STANDARD_VERSIONS.large,
    },
    primaryVersion: "large",
  },

  /**
   * Payment proof documents - original only, no resizing
   * Used in: Subscription payment proofs (images or PDFs)
   */
  "payment-proof": {
    versions: {
      original: STANDARD_VERSIONS.original,
      small: null,
      medium: null,
      large: null,
    },
    skipResize: true,
    s3Prefix: "payment-proofs/",
    primaryVersion: "original",
  },
};

/**
 * Default preset used when no specific preset is provided.
 */
export const DEFAULT_IMAGE_SIZE_PRESET: ImageSizePreset = "menu-item";
