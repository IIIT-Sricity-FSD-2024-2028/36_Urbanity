import { Module } from '@nestjs/common';
import { ComplaintUpdatesController } from './complaint-updates.controller';
import { complaintUpdatesProviders } from './complaint-updates.service';

@Module({
  controllers: [ComplaintUpdatesController],
  providers: complaintUpdatesProviders,
})
export class ComplaintUpdatesModule {}
