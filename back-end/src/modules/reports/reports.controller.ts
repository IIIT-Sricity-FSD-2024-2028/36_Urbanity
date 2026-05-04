import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/api-response';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@UseGuards(RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get Urbanity report overview' })
  @ApiOkResponse({ description: 'Report overview returned successfully.' })
  getOverview() {
    return apiResponse(this.reportsService.getOverview());
  }
}
