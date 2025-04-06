import { ApiProperty } from '@nestjs/swagger';

export class UploadImageResponseDto {
  @ApiProperty({
    description: 'The full public URL of the generated medium-sized image.',
    example:
      'https://your-bucket.s3.your-region.amazonaws.com/uploads/81eaa567-...-medium.webp',
  })
  imageUrl: string;
}
