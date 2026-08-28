import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AssignWorkerDto, CreateCommunityComplaintDto, CreateComplaintReviewDto, TransitionComplaintStatusDto, UpdateCommunityComplaintDto, WorkerActionDto } from './complaints.dto';
import { ComplaintsService } from './complaints.service';
@ApiTags('complaints') @ApiBearerAuth('bearerAuth') @UseGuards(RolesGuard) @Controller('complaints')
export class ComplaintsController {
  constructor(private readonly service: ComplaintsService) {}
  @Get() @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker) findAll(@CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.findAllForActor(user)); }
  @Get(':id') @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker) findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.findByIdForActor(user, id)); }
  @Post() @Roles(RoleName.Resident) create(@Body() dto: CreateCommunityComplaintDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.create(user, dto)); }
  @Patch(':id') @Roles(RoleName.CommunityAdmin, RoleName.Resident) update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommunityComplaintDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.update(user, id, dto)); }
  @Patch(':id/status') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker) transitionStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionComplaintStatusDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.transitionStatus(id, dto, user)); }
  @Get(':id/eligible-workers') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative) eligibleWorkers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.eligibleWorkers(user, id)); }
  @Post(':id/assign') @Roles(RoleName.CommunityAdmin, RoleName.TowerRepresentative) assignWorker(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignWorkerDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.assignWorker(id, dto, user)); }
  @Patch(':id/start') @Roles(RoleName.MaintenanceWorker) startWork(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: WorkerActionDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.startWork(id, user)); }
  @Patch(':id/resolve') @Roles(RoleName.MaintenanceWorker) resolveWork(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: WorkerActionDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.resolveWork(id, user)); }
  @Post(':id/review') @Roles(RoleName.Resident) submitReview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateComplaintReviewDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.submitReview(id, dto, user)); }
  @Get(':id/review') @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.Resident) findReview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.findReviewForActor(id, user)); }
  @Delete(':id') @Roles(RoleName.CommunityAdmin) delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.delete(user, id)); }
}
