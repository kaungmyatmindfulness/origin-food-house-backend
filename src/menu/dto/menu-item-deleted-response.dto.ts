import { ApiProperty } from '@nestjs/swagger';

export class MenuItemDeletedResponseDto {
  @ApiProperty({
    description: 'The ID (UUID) of the deleted menu item.',
    example: 1,
  })
  id: string;
}
