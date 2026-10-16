import { Module } from '@nestjs/common';
import { ComplaintsModule } from '../complaints/complaints.module';
import { WorkforceModule } from '../workforce/workforce.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [ComplaintsModule, WorkforceModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
