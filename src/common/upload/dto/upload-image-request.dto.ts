import { ApiProperty } from '@nestjs/swagger';

export class UploadImageRequestDto {
  @ApiProperty({
    type: 'string',
    format: 'binary', // This informs Swagger UI to show a file upload input
    description:
      'The image file to upload (jpg, jpeg, png, webp are validated). Max size: 10MB.',
    required: true,
  })
  file: any;
}
