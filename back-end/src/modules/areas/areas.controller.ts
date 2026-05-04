import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { areasResource } from './areas.service';

export const AreasController = createUrbanityController(areasResource);
