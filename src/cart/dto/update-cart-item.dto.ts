import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    description: 'ID (UUID) of the CartItem to update.',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID('all')
  cartItemId: string;

  @ApiPropertyOptional({
    description: 'New quantity for the item.',
    example: 2,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer.' })
  @Min(1, { message: 'quantity must be at least 1.' })
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Updated special instructions or notes. Send null to clear.',
    example: 'No onions please.',
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @MaxLength(255)
  @ValidateIf((o, v) => v !== null)
  @IsString()
  notes?: string | null;
}
