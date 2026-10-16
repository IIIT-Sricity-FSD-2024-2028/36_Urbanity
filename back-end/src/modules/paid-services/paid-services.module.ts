import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommunityModule } from '../community/community.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { PaidServicesController } from './paid-services.controller';
import { PaidServicesService } from './paid-services.service';
import { PaidServiceEvidenceService, PAID_SERVICE_UPLOAD_DIRECTORY } from './paid-service-evidence.service';
import { resolve } from 'path';

@Module({ imports: [UsersModule, CommunityModule, WorkforceModule, ComplaintsModule, SubscriptionModule], controllers: [PaidServicesController], providers: [PaidServicesService, PaidServiceEvidenceService, { provide: PAID_SERVICE_UPLOAD_DIRECTORY, useFactory: () => resolve(process.cwd(), 'uploads', 'paid-services') }] })
export class PaidServicesModule {}
