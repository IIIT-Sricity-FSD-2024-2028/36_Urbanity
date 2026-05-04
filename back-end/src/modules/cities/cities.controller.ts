import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { citiesResource } from './cities.service';

export const CitiesController = createUrbanityController(citiesResource);
