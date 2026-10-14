import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import {
  AmenityDto,
  BookingWindowDto,
  CreateBookingDto,
  MaintenanceBlockDto,
  ReasonDto,
} from './amenities.dto';
import { AmenitiesService } from './amenities.service';

@ApiTags('Amenities')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleName.CommunityAdmin, RoleName.Resident)
@Controller('amenities')
export class AmenitiesController {
  constructor(private readonly service: AmenitiesService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.service.list(actor));
  }
  @Post()
  @Roles(RoleName.CommunityAdmin)
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: AmenityDto) {
    return apiResponse(this.service.create(actor, dto));
  }
  @Patch(':id')
  @Roles(RoleName.CommunityAdmin)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AmenityDto,
  ) {
    return apiResponse(this.service.update(actor, id, dto));
  }
  @Post(':id/availability')
  availability(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BookingWindowDto,
  ) {
    return apiResponse(this.service.availability(actor, id, dto));
  }
  @Post(':id/bookings')
  @Roles(RoleName.Resident)
  book(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBookingDto,
  ) {
    return apiResponse(this.service.book(actor, id, dto));
  }
  @Get(':id/blocks')
  blocks(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return apiResponse(this.service.listBlocks(actor, id));
  }
  @Post(':id/blocks')
  @Roles(RoleName.CommunityAdmin)
  block(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MaintenanceBlockDto,
  ) {
    return apiResponse(this.service.block(actor, id, dto));
  }
  @Patch(':id/blocks/:blockId/release')
  @Roles(RoleName.CommunityAdmin)
  release(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ) {
    return apiResponse(this.service.releaseBlock(actor, id, blockId));
  }
}
@ApiTags('Amenity bookings')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(RoleName.CommunityAdmin, RoleName.Resident)
@Controller('amenity-bookings')
export class AmenityBookingsController {
  constructor(private readonly service: AmenitiesService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.service.listBookings(actor));
  }
  @Patch(':id/approve')
  @Roles(RoleName.CommunityAdmin)
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return apiResponse(
      this.service.transition(actor, id, 'APPROVED', dto.reason),
    );
  }
  @Patch(':id/reject')
  @Roles(RoleName.CommunityAdmin)
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return apiResponse(
      this.service.transition(actor, id, 'REJECTED', dto.reason),
    );
  }
  @Patch(':id/cancel')
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return apiResponse(
      this.service.transition(actor, id, 'CANCELLED', dto.reason),
    );
  }
}
