import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateWorkerProfileDto, UpdateWorkerProfileDto } from './workforce.dto';
import { WorkforceService } from './workforce.service';

@ApiTags('workforce')
@ApiBearerAuth('bearerAuth')
@UseGuards(RolesGuard)
@Controller('workforce/workers')
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}
  @Get() @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative) findAll(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.findAllForActor(actor)); }
  @Get('me') @Roles(RoleName.MaintenanceWorker) findOwn(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.findOwn(actor)); }
  @Get(':id') @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin, RoleName.TowerRepresentative, RoleName.MaintenanceWorker) findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.findByIdForActor(actor, id)); }
  @Post() @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin) create(@Body() dto: CreateWorkerProfileDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.createForActor(actor, dto)); }
  @Patch(':id') @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin) update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkerProfileDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.updateForActor(actor, id, dto)); }
  @Delete(':id') @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin) deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.deactivateForActor(actor, id)); }
}
