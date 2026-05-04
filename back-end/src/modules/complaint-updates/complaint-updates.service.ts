import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const complaintUpdatesResource = resourceByName('complaint-updates');
export const complaintUpdatesProviders = createResourceProviders(
  complaintUpdatesResource,
);
