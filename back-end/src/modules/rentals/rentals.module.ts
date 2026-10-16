import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import { UsersModule } from '../users/users.module';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({ imports: [CommunityModule, UsersModule], controllers: [RentalsController], providers: [RentalsService] })
export class RentalsModule {}
