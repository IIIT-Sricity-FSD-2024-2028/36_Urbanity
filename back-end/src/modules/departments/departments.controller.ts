import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { departmentsResource } from './departments.service';

export const DepartmentsController =
  createUrbanityController(departmentsResource);
