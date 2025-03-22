import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a4f5f3a9bfbb4ebeb70ac3846e8c9dd4',
    description: 'Reset token',
  })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewStr0ngP@ss', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
