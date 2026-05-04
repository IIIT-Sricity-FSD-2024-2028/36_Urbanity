import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { areasProviders } from './areas.service';

@Module({
  controllers: [AreasController],
  providers: areasProviders,
})
export class AreasModule {}
