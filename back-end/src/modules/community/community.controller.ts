import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { AssociateApartmentDto, AssociateTowerDto, CreateApartmentDto, CreateCommunityDto, CreateFloorDto, CreateTowerDto, UpdateApartmentDto, UpdateCommunityDto, UpdateFloorDto, UpdateTowerDto } from './hierarchy.dto';
import { CommunityService } from './community.service';

@UseGuards(RolesGuard)
@ApiTags('community hierarchy')
@ApiBearerAuth('bearerAuth')
@Controller()
export class CommunityController {
  constructor(private readonly service: CommunityService) {}

  @Get('communities') communities(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.listCommunitiesForActor(actor)); }
  @Get('communities/:id') community(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.getCommunityForActor(actor, id)); }
  @Post('communities') @Roles(RoleName.SuperAdmin) createCommunity(@Body() dto: CreateCommunityDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.createCommunityForActor(actor, dto)); }
  @Patch('communities/:id') @Roles(RoleName.SuperAdmin) updateCommunity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommunityDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.updateCommunityForActor(actor, id, dto)); }
  @Delete('communities/:id') @Roles(RoleName.SuperAdmin) deleteCommunity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.deleteCommunityForActor(actor, id)); }

  @Get('towers') towers(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.listTowersForActor(actor)); }
  @Get('towers/:id') tower(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.getTowerForActor(actor, id)); }
  @Post('towers') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) createTower(@Body() dto: CreateTowerDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.createTowerForActor(actor, dto)); }
  @Patch('towers/:id') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) updateTower(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTowerDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.updateTowerForActor(actor, id, dto)); }
  @Delete('towers/:id') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) deleteTower(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.deleteTowerForActor(actor, id)); }

  @Get('floors') floors(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.listFloorsForActor(actor)); }
  @Get('floors/:id') floor(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.getFloorForActor(actor, id)); }
  @Post('floors') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) createFloor(@Body() dto: CreateFloorDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.createFloorForActor(actor, dto)); }
  @Patch('floors/:id') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) updateFloor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFloorDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.updateFloorForActor(actor, id, dto)); }
  @Delete('floors/:id') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) deleteFloor(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.deleteFloorForActor(actor, id)); }

  @Get('apartments') apartments(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.listApartmentsForActor(actor)); }
  @Get('apartments/:id') apartment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.getApartmentForActor(actor, id)); }
  @Post('apartments') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) createApartment(@Body() dto: CreateApartmentDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.createApartmentForActor(actor, dto)); }
  @Patch('apartments/:id') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) updateApartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApartmentDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.updateApartmentForActor(actor, id, dto)); }
  @Delete('apartments/:id') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) deleteApartment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.deleteApartmentForActor(actor, id)); }

  @Patch('users/:id/resident-apartment') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) associateResident(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssociateApartmentDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.associateResident(actor, id, dto)); }
  @Patch('users/:id/representative-tower') @Roles(RoleName.CommunityAdmin, RoleName.SuperAdmin) associateRepresentative(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssociateTowerDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.associateRepresentative(actor, id, dto)); }
  @Get('users/me/hierarchy') resolveOwnHierarchy(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.resolveOwnHierarchy(actor)); }
  @Get('users/:id/resident-hierarchy') resolveResidentHierarchy(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.service.resolveResidentHierarchyForActor(actor, id)); }
}
