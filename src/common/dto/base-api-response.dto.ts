import { ApiProperty } from '@nestjs/swagger';
import { ErrorDetail } from 'src/common/dto/error-detail.dto'; // Assuming path is correct
import { Type } from 'class-transformer'; // Needed for Swagger array type recognition
import { ValidateNested } from 'class-validator'; // If you need validation on the array

export class BaseApiResponse<T> {
  @ApiProperty({ example: 'success', enum: ['success', 'error'] }) // Use enum for clarity
  status: 'success' | 'error';

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Response data payload when status is "success".',
  })
  data: T | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'Operation successful',
    description:
      'A general human-readable message about the operation outcome.',
  })
  message: string | null;

  // Changed 'error' to 'errors' and made it an array
  @ApiProperty({
    required: false,
    nullable: true,
    type: [ErrorDetail], // Specify array type for Swagger
    description:
      'Array of error details when status is "error". Usually empty on success.',
  })
  @ValidateNested({ each: true }) // Optional: Validate each ErrorDetail if needed
  @Type(() => ErrorDetail) // Required for class-transformer if using ValidationPipe
  errors: ErrorDetail[] | null;

  constructor(
    data: T | null,
    message: string | null = null,
    status: 'success' | 'error' = 'success',
    // Accept single or multiple errors for convenience
    errorOrErrors?: ErrorDetail | ErrorDetail[] | null,
  ) {
    this.status = status;
    this.data = data;
    this.message = message;

    // Standardize to null or an array
    if (!errorOrErrors) {
      this.errors = null;
    } else if (Array.isArray(errorOrErrors)) {
      this.errors = errorOrErrors.length > 0 ? errorOrErrors : null;
    } else {
      this.errors = [errorOrErrors];
    }

    // Adjust status based on errors if not explicitly set to error
    if (this.errors && this.errors.length > 0 && status === 'success') {
      this.status = 'error';
    }

    // Ensure data is null on error
    if (this.status === 'error') {
      this.data = null;
      // Optionally set a default error message if none provided
      // if (!this.message && this.errors && this.errors.length > 0) {
      //   this.message = this.errors[0].message || 'An error occurred.';
      // }
    }
  }

  // Convenience static method for success responses
  static success<T>(
    data: T,
    message: string | null = null,
  ): BaseApiResponse<T> {
    return new BaseApiResponse(data, message, 'success', null);
  }

  // Convenience static method for error responses
  static error(
    errors: ErrorDetail | ErrorDetail[],
    message: string | null = null,
  ): BaseApiResponse<null> {
    return new BaseApiResponse(null, message, 'error', errors);
  }
}
