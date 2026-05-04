import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { departmentsProviders } from './departments.service';

@Module({
  controllers: [DepartmentsController],
  providers: departmentsProviders,
})
export class DepartmentsModule {}
