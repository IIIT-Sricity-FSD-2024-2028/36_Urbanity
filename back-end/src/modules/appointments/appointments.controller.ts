import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CancelAppointmentDto, ConfirmAppointmentDto, CreateAppointmentDto, MarkMissedDto, RecordArrivalDto, RecordOutcomeDto, RequestRescheduleDto, RescheduleDecisionDto, WorkerScheduleQueryDto } from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments') @ApiBearerAuth('bearerAuth') @UseGuards(RolesGuard) @Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}
  @Get('time-slots') @Roles(RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker) timeSlots() { return apiResponse(this.service.timeSlots()); }
  @Get('workers/:workerId/schedule') @Roles(RoleName.TowerRepresentative) workerSchedule(@Param('workerId', ParseUUIDPipe) workerId: string, @Query() query: WorkerScheduleQueryDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.workerSchedule(user, workerId, query.date)); }
  @Get() @Roles(RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker) findAll(@CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.listForActor(user)); }
  @Get(':id') @Roles(RoleName.TowerRepresentative, RoleName.Resident, RoleName.MaintenanceWorker) findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.findForActor(user, id)); }
  @Post() @Roles(RoleName.Resident) request(@Body() dto: CreateAppointmentDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.request(user, dto)); }
  @Patch(':id/reschedule') @Roles(RoleName.Resident) requestReschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RequestRescheduleDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.requestReschedule(user, id, dto)); }
  @Patch(':id/cancel') @Roles(RoleName.Resident, RoleName.TowerRepresentative) cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelAppointmentDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.cancel(user, id, dto)); }
  @Patch(':id/confirm') @Roles(RoleName.TowerRepresentative) confirm(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmAppointmentDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.confirm(user, id, dto)); }
  @Patch(':id/reschedule-decision') @Roles(RoleName.TowerRepresentative) decideReschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RescheduleDecisionDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.decideReschedule(user, id, dto)); }
  @Patch(':id/missed') @Roles(RoleName.TowerRepresentative) markMissed(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MarkMissedDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.markMissed(user, id, dto)); }
  @Patch(':id/arrival') @Roles(RoleName.MaintenanceWorker) recordArrival(@Param('id', ParseUUIDPipe) id: string, @Body() _dto: RecordArrivalDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.recordArrival(user, id)); }
  @Patch(':id/outcome') @Roles(RoleName.MaintenanceWorker) recordOutcome(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordOutcomeDto, @CurrentUser() user: AuthenticatedUser) { return apiResponse(this.service.recordOutcome(user, id, dto)); }
}
