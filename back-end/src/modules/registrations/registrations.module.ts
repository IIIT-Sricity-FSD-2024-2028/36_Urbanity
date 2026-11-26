import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommunityModule } from '../community/community.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { RegistrationService } from './registration.service';
import {
  PublicRegistrationController,
  RegistrationAbuseGuard,
  RegistrationAdminController,
  PlatformPaymentController,
} from './registration.controller';

@Module({
  imports: [UsersModule, CommunityModule, SubscriptionModule],
  controllers: [PublicRegistrationController, RegistrationAdminController, PlatformPaymentController],
  providers: [RegistrationService, RegistrationAbuseGuard],
  exports: [RegistrationService],
})
export class RegistrationsModule {}
