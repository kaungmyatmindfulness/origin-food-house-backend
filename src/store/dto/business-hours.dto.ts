import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';

export class DayHoursDto {
  @ApiProperty({
    description: 'Whether the store is closed on this day',
    example: false,
  })
  @IsBoolean()
  closed: boolean;

  @ApiProperty({
    description: 'Opening time in HH:MM format (required if not closed)',
    example: '09:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Opening time must be in HH:MM format',
  })
  open?: string;

  @ApiProperty({
    description: 'Closing time in HH:MM format (required if not closed)',
    example: '22:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Closing time must be in HH:MM format',
  })
  close?: string;
}

export class BusinessHoursDto {
  @ApiProperty({
    description: 'Business hours for Monday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  monday: DayHoursDto;

  @ApiProperty({
    description: 'Business hours for Tuesday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  tuesday: DayHoursDto;

  @ApiProperty({
    description: 'Business hours for Wednesday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  wednesday: DayHoursDto;

  @ApiProperty({
    description: 'Business hours for Thursday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  thursday: DayHoursDto;

  @ApiProperty({
    description: 'Business hours for Friday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  friday: DayHoursDto;

  @ApiProperty({
    description: 'Business hours for Saturday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  saturday: DayHoursDto;

  @ApiProperty({
    description: 'Business hours for Sunday',
    type: DayHoursDto,
  })
  @ValidateNested()
  @Type(() => DayHoursDto)
  sunday: DayHoursDto;
}
