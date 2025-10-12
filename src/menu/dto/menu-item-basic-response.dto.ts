import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class MenuItemBasicResponseDto {
  @ApiProperty({ format: 'uuid' }) @Expose() id: string;
  @ApiProperty() @Expose() name: string;
  @ApiPropertyOptional({ nullable: true }) @Expose() imageUrl?: string | null;
  @ApiProperty({ type: String }) @Expose() basePrice: string; // Assuming string output for Decimal
}

// src/menu/dto/customization-option-response.dto.ts (Example - Assumed exists)
// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import { Expose, Type } from 'class-transformer';
// export class CustomizationOptionResponseDto {
//     @ApiProperty({ format: 'uuid' }) @Expose() id: string;
//     @ApiProperty() @Expose() name: string;
//     @ApiPropertyOptional({ type: String, nullable: true }) @Expose() @Type(() => String) additionalPrice?: string | null;
// }
