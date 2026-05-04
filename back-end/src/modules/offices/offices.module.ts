import { Module } from '@nestjs/common';
import { OfficesController } from './offices.controller';
import { officesProviders } from './offices.service';

@Module({
  controllers: [OfficesController],
  providers: officesProviders,
})
export class OfficesModule {}
