import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CustomizationGroupResponseDto } from './customization-group-response.dto';

export class MenuItemNestedResponseDto {
  @ApiProperty({ example: 147 })
  id: number;

  @ApiProperty({ example: 'Generic Granite Cheese' })
  name: string;

  @ApiPropertyOptional({
    example: 'The lavender Bike combines...',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({ type: String, example: '49.11', nullable: true })
  basePrice: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ example: 2 })
  sortOrder: number;

  @ApiProperty({ type: () => [CustomizationGroupResponseDto] })
  @Type(() => CustomizationGroupResponseDto)
  customizationGroups: CustomizationGroupResponseDto[];
}
