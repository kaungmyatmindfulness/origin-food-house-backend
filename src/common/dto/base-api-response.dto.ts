import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorDetail } from './error-detail.dto';

export class BaseApiResponse<T> {
  @ApiProperty({ enum: ['success', 'error'] })
  status: 'success' | 'error';

  @ApiPropertyOptional({ nullable: true })
  message?: string | null;

  @ApiPropertyOptional({ nullable: true })
  data?: T | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Error details (single or array).',
    oneOf: [
      {
        type: 'array',
        items: { $ref: getSchemaPath(ErrorDetail) },
      },
      { $ref: getSchemaPath(ErrorDetail) },
    ],
  })
  error?: ErrorDetail | ErrorDetail[] | null;
}
