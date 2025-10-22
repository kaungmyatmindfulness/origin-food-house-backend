import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class JoinSessionDto {
  @ApiProperty({
    description: 'Number of guests in the session',
    example: 4,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guestCount?: number;
}
