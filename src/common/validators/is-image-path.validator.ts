import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";

import { isValidImagePath } from "../utils/image-path.util";

/**
 * Custom validator to check if a string is a valid image base path.
 * Validates that the path:
 * - Starts with 'uploads/' or 'payment-proofs/'
 * - Contains only alphanumeric characters, hyphens, and slashes
 * - Does NOT contain version suffixes (-small, -medium, -large, -original)
 * - Does NOT contain full URLs (no protocol)
 *
 * Valid examples:
 * - "uploads/abc-123-def"
 * - "payment-proofs/store-id/uuid-123"
 *
 * Invalid examples:
 * - "uploads/abc-123-medium.webp" (contains version suffix)
 * - "https://bucket.s3.amazonaws.com/uploads/abc" (full URL)
 * - "invalid/path" (wrong prefix)
 */
export function IsImagePath(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isImagePath",
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

          // Use utility function for validation
          return isValidImagePath(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid image base path (e.g., 'uploads/uuid' or 'payment-proofs/store-id/uuid')`;
        },
      },
    });
  };
}
