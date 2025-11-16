import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";

/**
 * Custom validator to check if a string is a valid S3 image URL.
 * Validates that the URL:
 * - Is a valid URL format
 * - Uses HTTPS protocol
 * - Matches S3 bucket patterns (s3.amazonaws.com or s3.region.amazonaws.com)
 * - Has appropriate file extensions for images or payment proofs
 */
export function IsS3ImageUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isS3ImageUrl",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          // Allow null/undefined for optional fields
          if (value === null || value === undefined) {
            return true;
          }

          // Must be a string
          if (typeof value !== "string") {
            return false;
          }

          // Must be a valid URL
          let url: URL;
          try {
            url = new URL(value);
          } catch {
            return false;
          }

          // Must use HTTPS protocol
          if (url.protocol !== "https:") {
            return false;
          }

          // Must match S3 hostname patterns
          const s3HostnamePattern =
            /^[a-z0-9.-]+\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/i;
          if (!s3HostnamePattern.test(url.hostname)) {
            return false;
          }

          // Must have a valid file path
          if (!url.pathname || url.pathname === "/") {
            return false;
          }

          // Optional: Check for valid image extensions
          const validExtensions = [
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".pdf",
            ".gif",
            ".svg",
          ];
          const hasValidExtension = validExtensions.some((ext) =>
            url.pathname.toLowerCase().endsWith(ext),
          );

          if (!hasValidExtension) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid S3 image URL (HTTPS, valid S3 hostname, and supported file extension)`;
        },
      },
    });
  };
}
