import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { UsersModule } from '../users/users.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [UsersModule, CommunityModule, ComplaintsModule, WorkforceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
