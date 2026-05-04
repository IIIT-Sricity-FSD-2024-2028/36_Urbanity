import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { complaintUpdatesResource } from './complaint-updates.service';

export const ComplaintUpdatesController = createUrbanityController(
  complaintUpdatesResource,
);
