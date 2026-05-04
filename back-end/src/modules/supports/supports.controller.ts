import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { supportsResource } from './supports.service';

export const SupportsController = createUrbanityController(supportsResource);
