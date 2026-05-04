import { Module } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { citiesProviders } from './cities.service';

@Module({
  controllers: [CitiesController],
  providers: citiesProviders,
})
export class CitiesModule {}
