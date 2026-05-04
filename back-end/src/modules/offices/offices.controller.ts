import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { officesResource } from './offices.service';

export const OfficesController = createUrbanityController(officesResource);
