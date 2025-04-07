import { ApiProperty } from '@nestjs/swagger';

export class StandardApiErrorDetails {
  @ApiProperty({
    description:
      'Machine-readable error code identifying the error type (e.g., validation, auth, system error).',
    example: 'ERROR_CODE_IDENTIFIER',
    required: true,
  })
  code: string;

  @ApiProperty({
    description: 'A human-readable message specifically describing this error.',
    example: 'A detailed error message explaining what went wrong.',
    required: true,
  })
  message: string;

  @ApiProperty({
    description:
      'Identifies the specific input field related to the error, if applicable (often used for validation errors).',
    example: 'relevantFieldName',
    required: false,
    nullable: true,
  })
  field?: string | null;

  constructor(code: string, message: string, field?: string | null) {
    this.code = code;
    this.message = message;
    this.field = field;
  }
}
