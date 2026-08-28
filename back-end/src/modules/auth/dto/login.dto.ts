import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'arjun.mehta@urbanity.gov' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'arjun123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
