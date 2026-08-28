import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CreateUserDto, UpdateUserDto } from '../../data/schemas';
import { apiResponse } from '../../common/api-response';
import { UserAccessService } from './user-access.service';

@UseGuards(RolesGuard)
@Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UserAccessService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.users.list(actor)); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.users.get(actor, id)); }
  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.users.create(actor, dto)); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.users.update(actor, id, dto)); }
  @Delete(':id') delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) { return apiResponse(this.users.delete(actor, id)); }
}
