import { Module } from '@nestjs/common';
import { ComplaintsModule } from '../complaints/complaints.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DashboardModule, ComplaintsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
