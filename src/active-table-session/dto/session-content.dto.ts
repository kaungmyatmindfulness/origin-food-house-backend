// src/active-table-session/dto/session-context.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * DTO representing the Session Context attached to the request user property
 * after successful CustomerSessionJwtAuthGuard validation.
 */
export class SessionContextDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'ID of the active table session associated with the request token.',
    example: '018ecf8a-4a7d-7b9a-b03d-3f4f72c55a1e',
  })
  @Expose() // Important if using ClassSerializerInterceptor with excludeAll
  sessionId: string;
}
