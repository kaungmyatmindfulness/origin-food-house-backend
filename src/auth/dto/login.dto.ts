import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'The user’s email address',
  })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'The user’s password',
  })
  password: string;
}
