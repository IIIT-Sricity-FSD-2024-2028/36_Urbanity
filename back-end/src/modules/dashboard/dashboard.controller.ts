import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth('bearerAuth')
@UseGuards(RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(RoleName.SuperAdmin, RoleName.CommunityAdmin)
  @ApiOperation({ summary: 'Get dashboard summary metrics' })
  @ApiOkResponse({ description: 'Dashboard summary returned successfully.' })
  getSummary(@CurrentUser() actor: AuthenticatedUser) {
    return apiResponse(this.dashboardService.getSummary(actor));
  }
}
