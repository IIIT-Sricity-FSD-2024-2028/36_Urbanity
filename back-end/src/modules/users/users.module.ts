import { forwardRef, Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { SubscriptionModule } from '../subscriptions/subscription.module';
import { UsersController } from './users.controller';
import { usersProviders } from './users.service';
import { UserAccessService } from './user-access.service';

@Module({
  imports: [forwardRef(() => CommunityModule), forwardRef(() => SubscriptionModule)],
  controllers: [UsersController],
  providers: [...usersProviders, UserAccessService],
  exports: [...usersProviders, UserAccessService],
})
export class UsersModule {}
