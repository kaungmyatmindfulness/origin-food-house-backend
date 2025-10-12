import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

import { StandardApiErrorDetails } from 'src/common/dto/standard-api-error-details.dto';

export class StandardApiResponse<T> {
  @ApiProperty({ example: 'success', enum: ['success', 'error'] })
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

  @ApiProperty({
    required: false,
    nullable: true,
    type: [StandardApiErrorDetails],
    description:
      'Array of error details when status is "error". Usually empty on success.',
  })
  @ValidateNested({ each: true })
  @Type(() => StandardApiErrorDetails)
  errors: StandardApiErrorDetails[] | null;

  constructor(
    data: T | null,
    message: string | null = null,
    status: 'success' | 'error' = 'success',

    errorOrErrors?: StandardApiErrorDetails | StandardApiErrorDetails[] | null,
  ) {
    this.status = status;
    this.data = data;
    this.message = message;

    if (!errorOrErrors) {
      this.errors = null;
    } else if (Array.isArray(errorOrErrors)) {
      this.errors = errorOrErrors.length > 0 ? errorOrErrors : null;
    } else {
      this.errors = [errorOrErrors];
    }

    if (this.errors && this.errors.length > 0 && status === 'success') {
      this.status = 'error';
    }

    if (this.status === 'error') {
      this.data = null;

      if (!this.message && this.errors && this.errors.length > 0) {
        this.message = this.errors[0].message || 'An error occurred.';
      }
    }
  }

  static success<T>(
    data: T,
    message: string | null = null,
  ): StandardApiResponse<T> {
    return new StandardApiResponse(data, message, 'success', null);
  }

  static error(
    errors: StandardApiErrorDetails | StandardApiErrorDetails[],
    message: string | null = null,
  ): StandardApiResponse<null> {
    return new StandardApiResponse(null, message, 'error', errors);
  }
}
