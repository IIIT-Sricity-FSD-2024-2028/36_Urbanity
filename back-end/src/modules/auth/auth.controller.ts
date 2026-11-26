import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import type { ApiResponse } from '../../common/api-response';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticationResult } from './interfaces/auth.interface';
import type { AuthenticatedUser } from './interfaces/auth.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AllowPaymentPending, PlatformAccessService } from './platform-access.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly access: PlatformAccessService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Authenticate a user by email and password and receive a JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiCreatedResponse({ description: 'JWT access token issued successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  login(@Body() loginDto: LoginDto): ApiResponse<AuthenticationResult> {
    const result = this.authService.login(loginDto);
    return apiResponse({ ...result, user: this.withPaymentAccess(result.user) });
  }

  @Get('me')
  @AllowPaymentPending()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Get the authenticated user context' })
  me(@CurrentUser() user: AuthenticatedUser): ApiResponse<AuthenticatedUser> {
    return apiResponse(this.withPaymentAccess(user));
  }

  private withPaymentAccess<T extends AuthenticatedUser>(user: T): T {
    return this.access.requiresPayment(user) ? { ...user, platformPaymentRequired: true } : user;
  }
}
