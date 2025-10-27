import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @ApiProperty({
    description: 'Reason for suspending the user',
    example: 'Violated company policy on multiple occasions',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
