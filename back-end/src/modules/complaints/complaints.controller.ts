import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { complaintsResource } from './complaints.service';

export const ComplaintsController =
  createUrbanityController(complaintsResource);
