import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StoreInformationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  storeId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  website?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
