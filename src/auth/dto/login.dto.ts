import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'The user’s email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'The user’s password',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
