import { ApiProperty } from '@nestjs/swagger';

export class StandardApiErrorDetails {
  @ApiProperty({
    description:
      'Machine-readable error code (e.g., validation, auth, system error).',
    example: 'VALIDATION_ERROR', // Keep current example
    // Consider adding more examples: 'NOT_FOUND', 'UNAUTHENTICATED', 'RATE_LIMIT_EXCEEDED', 'INTERNAL_SERVER_ERROR'
    required: true, // Code should always be present for an error
  })
  code: string;

  @ApiProperty({
    description: 'A human-readable message specifically describing this error.',
    example: 'Password must be at least 8 characters long',
    required: true, // Message should always be present
  })
  message: string;

  @ApiProperty({
    description:
      'Identifies the specific input field related to the error, if applicable (common for validation).',
    example: 'password',
    required: false, // Field is optional
    nullable: true,
  })
  field?: string | null; // Explicitly allow null

  // Optional: Add a path for nested objects if needed
  // @ApiProperty({
  //   description: 'Path to the field in nested structures.',
  //   example: 'user.address.postalCode',
  //   required: false,
  // })
  // path?: string;

  // Ensure constructor or default values if needed, though often populated directly
  constructor(code: string, message: string, field?: string | null) {
    this.code = code;
    this.message = message;
    this.field = field;
  }
}
