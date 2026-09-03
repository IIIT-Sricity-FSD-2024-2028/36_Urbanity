import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [forwardRef(() => UsersModule), SubscriptionModule],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
