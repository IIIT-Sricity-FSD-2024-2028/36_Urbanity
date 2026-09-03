import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AreasModule } from './modules/areas/areas.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuthModule } from './modules/auth/auth.module';
import { CitiesModule } from './modules/cities/cities.module';
import { CommunityModule } from './modules/community/community.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { OfficesModule } from './modules/offices/offices.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { SubscriptionModule } from './modules/subscriptions/subscription.module';
import { LoggingModule } from './common/logging/logging.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ComplaintRouteContextMiddleware } from './common/middleware/complaint-route-context.middleware';
import { ComplaintsController } from './modules/complaints/complaints.controller';
import { AttachmentsController } from './modules/attachments/attachments.controller';

@Module({
  imports: [
    LoggingModule,
    AuthModule,
    RolesModule,
    DepartmentsModule,
    OfficesModule,
    UsersModule,
    WorkforceModule,
    CitiesModule,
    AreasModule,
    CommunityModule,
    SubscriptionModule,
    ComplaintsModule,
    AttachmentsModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
    consumer
      .apply(ComplaintRouteContextMiddleware)
      .forRoutes(ComplaintsController, AttachmentsController);
  }
}
