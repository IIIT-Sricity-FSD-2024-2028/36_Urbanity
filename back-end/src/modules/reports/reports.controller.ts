import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('bearerAuth')
@UseGuards(RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin)
  @ApiOperation({ summary: 'Get Urbanity report overview' })
  @ApiOkResponse({ description: 'Report overview returned successfully.' })
  getOverview(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.reportsService.getOverview(actor));
  }
}
