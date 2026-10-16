import { Module } from '@nestjs/common';
import { CommunityModule } from '../community/community.module';
import {
  AmenitiesController,
  AmenityBookingsController,
} from './amenities.controller';
import { AmenitiesService } from './amenities.service';
@Module({
  imports: [CommunityModule],
  controllers: [AmenitiesController, AmenityBookingsController],
  providers: [AmenitiesService],
})
export class AmenitiesModule {}
