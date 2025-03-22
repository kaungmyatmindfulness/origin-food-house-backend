import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssword', minLength: 6 })
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({ example: 'NewP@ssword123', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
