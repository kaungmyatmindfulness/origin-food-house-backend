import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail } from 'class-validator';

/**
 * @deprecated This DTO is deprecated. Auth0 handles user registration.
 * Use Auth0 registration flow instead.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe', required: false })
  @IsString()
  name?: string;
}
