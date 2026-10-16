import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpException,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { apiResponse } from '../../common/api-response';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import {
  ApplicationDto,
  EvidenceDto,
  PaymentReviewDto,
  PricingDto,
  ReviewDto,
  SetupDto,
  SizeDto,
  MockPaymentDto,
  AcceptanceDto,
} from './registration.dto';
import { RegistrationService } from './registration.service';

const cookieName = (id: string, setup = false) =>
  `urbanity_${setup ? 'setup' : 'registration'}_${id.replace(/[^a-zA-Z0-9]/g, '')}`;
const cookie = (req: Request, id: string, setup = false) =>
  req.headers.cookie
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${cookieName(id, setup)}=`))
    ?.split('=')[1];
const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

@Injectable()
export class RegistrationAbuseGuard implements CanActivate {
  private readonly windows = new Map<
    string,
    { count: number; until: number }
  >();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method !== 'GET' && !req.is('application/json'))
      throw new HttpException('JSON requests are required', 415);
    const time = Date.now();
    for (const [key, value] of this.windows)
      if (value.until < time) this.windows.delete(key);
    const submit =
      req.method === 'POST' && req.path.endsWith('/community-registrations');
    const key = `${req.ip}:${submit ? 'submit' : 'read'}`;
    const item = this.windows.get(key) ?? {
      count: 0,
      until: time + (submit ? 3600000 : 60000),
    };
    if (++item.count > (submit ? 10 : 90))
      throw new HttpException(
        'Too many registration requests. Please try again later.',
        429,
      );
    if (this.windows.size > 10000 && !this.windows.has(key))
      throw new HttpException('Please try again later', 429);
    this.windows.set(key, item);
    return true;
  }
}

@Public()
@UseGuards(RegistrationAbuseGuard)
@Controller('community-registrations')
export class PublicRegistrationController {
  constructor(private readonly service: RegistrationService) {}
  @Get('pricing') pricing() {
    return apiResponse(this.service.publicPricing());
  }
  @Post('quote') quote(@Body() dto: SizeDto) {
    return apiResponse(this.service.quote(dto));
  }
  @Post() submit(
    @Body() dto: ApplicationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const previousId = this.service.applicationIdForRequest(dto.requestId);
    const result = this.service.submit(
      dto,
      previousId ? cookie(req, previousId) : undefined,
    );
    if (result.secret)
      res.cookie(cookieName(result.application.id), result.secret, {
        ...options,
        maxAge: 30 * 86400000,
      });
    return apiResponse(result.application);
  }
  @Get(':id/status') status(@Param('id') id: string, @Req() req: Request) {
    return apiResponse(this.service.status(id, cookie(req, id)));
  }
  @Post(':id/mock-payments') mockPayment(
    @Param('id') id: string,
    @Body() dto: MockPaymentDto,
    @Req() req: Request,
  ) {
    return apiResponse(this.service.mockPayment(id, cookie(req, id), dto));
  }
  @Post(':id/payments') evidence(
    @Param('id') id: string,
    @Body() dto: EvidenceDto,
    @Req() req: Request,
  ) {
    return apiResponse(this.service.evidence(id, cookie(req, id), dto));
  }
  @Post(':id/setup-session') begin(
    @Param('id') id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.service.beginSetup(id, cookie(req, id));
    res.cookie(cookieName(id, true), result.token, {
      ...options,
      maxAge: 3600000,
    });
    return apiResponse({ expiresAt: result.expiresAt });
  }
  @Post(':id/credential-setup') setup(
    @Param('id') id: string,
    @Body() dto: SetupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.service.setup(
      id,
      cookie(req, id),
      cookie(req, id, true),
      dto.password,
    );
    res.clearCookie(cookieName(id, true), options);
    return apiResponse(result);
  }
}

@Controller('registration-administration')
@Roles(RoleName.SuperAdmin)
@UseGuards(RolesGuard)
export class RegistrationAdminController {
  constructor(private readonly service: RegistrationService) {}
  @Get('pricing') pricing() {
    return apiResponse(this.service.publicPricing());
  }
  @Patch('pricing') configure(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PricingDto,
  ) {
    return apiResponse(this.service.configure(actor, dto));
  }
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.service.list(actor));
  }
  @Get(':id') get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return apiResponse(this.service.get(actor, id));
  }
  @Post(':id/accept-and-notify') accept(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcceptanceDto,
  ) {
    return apiResponse(this.service.acceptAndNotify(actor, id, dto));
  }
  @Post(':id/review') review(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return apiResponse(this.service.review(actor, id, dto));
  }
  @Post(':id/payments/:paymentId/review') payment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: PaymentReviewDto,
  ) {
    return apiResponse(this.service.reviewPayment(actor, id, paymentId, dto));
  }
  @Post(':id/activate') activate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return apiResponse(this.service.activate(actor, id));
  }
}
