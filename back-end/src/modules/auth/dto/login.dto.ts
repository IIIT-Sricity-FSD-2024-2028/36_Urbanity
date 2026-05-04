import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'arjun.mehta@urbanity.gov' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'arjun123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('4')
  roleId: string;
}
