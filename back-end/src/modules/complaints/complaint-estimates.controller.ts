import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AdminEstimateDecisionDto, CancelComplaintEstimateDto, ExecuteMockPaymentDto, SubmitComplaintEstimateDto, TowerEstimateDecisionDto } from './complaint-estimates.dto';
import { ComplaintEstimatesService } from './complaint-estimates.service';

@ApiTags('complaint estimates')
@ApiBearerAuth('bearerAuth')
@UseGuards(RolesGuard)
@Controller('complaints')
export class ComplaintEstimatesController {
  constructor(private readonly estimates: ComplaintEstimatesService) {}

  @Get('estimates/queue')
  @Roles(RoleName.TowerRepresentative, RoleName.CommunityAdmin)
  list(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.estimates.list(actor));
  }

  @Get(':id/estimate')
  @Roles(RoleName.Resident, RoleName.MaintenanceWorker, RoleName.TowerRepresentative, RoleName.CommunityAdmin)
  get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return apiResponse(this.estimates.get(actor, id));
  }

  @Post(':id/estimate')
  @Roles(RoleName.MaintenanceWorker)
  submit(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitComplaintEstimateDto) {
    return apiResponse(this.estimates.submit(actor, id, dto));
  }

  @Patch(':id/estimates/:estimateId/tower-decision')
  @Roles(RoleName.TowerRepresentative)
  towerDecision(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string,
    @Param('estimateId', ParseUUIDPipe) estimateId: string, @Body() dto: TowerEstimateDecisionDto) {
    return apiResponse(this.estimates.decideAsTower(actor, id, estimateId, dto));
  }

  @Patch(':id/estimates/:estimateId/admin-decision')
  @Roles(RoleName.CommunityAdmin)
  adminDecision(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string,
    @Param('estimateId', ParseUUIDPipe) estimateId: string, @Body() dto: AdminEstimateDecisionDto) {
    return apiResponse(this.estimates.decideAsAdmin(actor, id, estimateId, dto));
  }

  @Patch(':id/estimates/:estimateId/cancel')
  @Roles(RoleName.TowerRepresentative)
  cancel(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string,
    @Param('estimateId', ParseUUIDPipe) estimateId: string, @Body() dto: CancelComplaintEstimateDto) {
    return apiResponse(this.estimates.cancel(actor, id, estimateId, dto.reason));
  }

  @Post(':id/estimates/:estimateId/mock-payment')
  @Roles(RoleName.CommunityAdmin)
  pay(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string,
    @Param('estimateId', ParseUUIDPipe) estimateId: string, @Body() dto: ExecuteMockPaymentDto) {
    return apiResponse(this.estimates.pay(actor, id, estimateId, dto.confirmed));
  }
}
