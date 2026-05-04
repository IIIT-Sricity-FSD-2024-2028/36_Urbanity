import { Module } from '@nestjs/common';
import { ComplaintsController } from './complaints.controller';
import { complaintsProviders } from './complaints.service';

@Module({
  controllers: [ComplaintsController],
  providers: complaintsProviders,
})
export class ComplaintsModule {}
