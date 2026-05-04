import { Module } from '@nestjs/common';
import { SupportsController } from './supports.controller';
import { supportsProviders } from './supports.service';

@Module({
  controllers: [SupportsController],
  providers: supportsProviders,
})
export class SupportsModule {}
