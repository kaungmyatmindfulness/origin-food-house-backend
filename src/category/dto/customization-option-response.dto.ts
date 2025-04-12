import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomizationOptionResponseDto {
  @ApiProperty({ example: 737 })
  id: string;
  @ApiProperty({ example: 'Bamboo' })
  name: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: '3.25' })
  additionalPrice: string | null;
  @ApiProperty({ example: 219 })
  customizationGroupId: string;
}
