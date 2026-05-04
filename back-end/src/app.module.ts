import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AreasModule } from './modules/areas/areas.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuthModule } from './modules/auth/auth.module';
import { CitiesModule } from './modules/cities/cities.module';
import { ComplaintUpdatesModule } from './modules/complaint-updates/complaint-updates.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { OfficesModule } from './modules/offices/offices.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RolesModule } from './modules/roles/roles.module';
import { SupportsModule } from './modules/supports/supports.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AuthModule,
    RolesModule,
    DepartmentsModule,
    OfficesModule,
    UsersModule,
    CitiesModule,
    AreasModule,
    ComplaintsModule,
    AssignmentsModule,
    ComplaintUpdatesModule,
    AttachmentsModule,
    SupportsModule,
    FeedbackModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
