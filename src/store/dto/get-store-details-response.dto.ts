import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

import { StoreInformationResponseDto } from './store-information-response.dto';
import { StoreSettingResponseDto } from './store-setting-response.dto';

export class GetStoreDetailsResponseDto {
  @ApiProperty({ format: 'uuid', description: "Store's unique identifier" })
  id: string;

  @ApiProperty({ description: "Store's unique URL slug", example: 'demo-cafe' })
  slug: string;

  @ApiProperty({ type: () => StoreInformationResponseDto, nullable: true })
  @Type(() => StoreInformationResponseDto)
  information?: StoreInformationResponseDto | null;

  @ApiProperty({ type: () => StoreSettingResponseDto, nullable: true })
  @Type(() => StoreSettingResponseDto)
  setting?: StoreSettingResponseDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
