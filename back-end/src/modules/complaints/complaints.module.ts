import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { UsersModule } from '../users/users.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [UsersModule, CommunityModule, WorkforceModule],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
