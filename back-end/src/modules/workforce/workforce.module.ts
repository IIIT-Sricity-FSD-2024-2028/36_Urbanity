import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { UsersModule } from '../users/users.module';
import { WorkforceController } from './workforce.controller';
import { WorkforceService } from './workforce.service';

@Module({ imports: [UsersModule, CommunityModule], controllers: [WorkforceController], providers: [WorkforceService], exports: [WorkforceService] })
export class WorkforceModule {}
