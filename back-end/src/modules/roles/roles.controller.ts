import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { rolesResource } from './roles.service';

export const RolesController = createUrbanityController(rolesResource);
