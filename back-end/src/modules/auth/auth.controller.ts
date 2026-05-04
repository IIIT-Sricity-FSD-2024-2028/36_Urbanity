import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import type { ApiResponse } from '../../common/api-response';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/auth.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Authenticate a user by email, password, and role' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'User authenticated successfully.' })
  login(@Body() loginDto: LoginDto): ApiResponse<AuthenticatedUser> {
    return apiResponse(this.authService.login(loginDto));
  }
}
