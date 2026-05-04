import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { usersResource } from './users.service';

export const UsersController = createUrbanityController(usersResource);
