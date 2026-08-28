import { forwardRef, Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { UsersController } from './users.controller';
import { usersProviders } from './users.service';
import { UserAccessService } from './user-access.service';

@Module({
  imports: [forwardRef(() => CommunityModule)],
  controllers: [UsersController],
  providers: [...usersProviders, UserAccessService],
  exports: [...usersProviders, UserAccessService],
})
export class UsersModule {}
