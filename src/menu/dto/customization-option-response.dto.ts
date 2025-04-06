import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomizationOptionResponseDto {
  @ApiProperty({ example: 737 })
  id: number;

  @ApiProperty({ example: 'Bamboo' })
  name: string;

  @ApiPropertyOptional({
    description: 'Additional price for this option, formatted as string.',
    example: '3.25',
    type: String,
    nullable: true,
  })
  additionalPrice: string | null;

  @ApiProperty({ example: 219 })
  customizationGroupId: number;

  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;
}
