import { ApiProperty } from '@nestjs/swagger';

export class ErrorDetail {
  @ApiProperty({
    description: 'Machine-readable error code.',
    example: 'VALIDATION_ERROR',
  })
  code: string;

  @ApiProperty({
    description: 'A human-readable message describing the error.',
    example: 'Email is required',
  })
  message: string;

  @ApiProperty({
    description: 'An optional field name for validation errors.',
    example: 'email',
    required: false,
  })
  field?: string;
}
