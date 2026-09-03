import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { SubscriptionService } from './subscription.service';
import { RequestUpgradeDto } from './subscription.dto';

@UseGuards(RolesGuard)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}
  @Get() @Roles(RoleName.SuperAdmin) list(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.subscriptions.listForSuperAdmin(actor)); }
  @Roles(RoleName.CommunityAdmin)
  @Get('me') getMine(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.subscriptions.getForActor(actor)); }
  @Roles(RoleName.CommunityAdmin)
  @Post('me/mock-payment') pay(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.subscriptions.completeMockPayment(actor)); }
  @Post('me/upgrade') @Roles(RoleName.CommunityAdmin) requestUpgrade(@Body() dto: RequestUpgradeDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.subscriptions.requestUpgrade(actor, dto)); }
  @Post('me/upgrade/mock-payment') @Roles(RoleName.CommunityAdmin) payUpgrade(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.subscriptions.completeMockUpgrade(actor)); }
}
