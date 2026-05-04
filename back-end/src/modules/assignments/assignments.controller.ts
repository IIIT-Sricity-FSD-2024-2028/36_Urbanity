import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { assignmentsResource } from './assignments.service';

export const AssignmentsController =
  createUrbanityController(assignmentsResource);
