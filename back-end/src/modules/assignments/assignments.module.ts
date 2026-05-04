import { Module } from '@nestjs/common';
import { AssignmentsController } from './assignments.controller';
import { assignmentsProviders } from './assignments.service';

@Module({
  controllers: [AssignmentsController],
  providers: assignmentsProviders,
})
export class AssignmentsModule {}
