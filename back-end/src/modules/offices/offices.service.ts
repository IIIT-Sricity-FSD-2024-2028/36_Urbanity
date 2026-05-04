import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const officesResource = resourceByName('offices');
export const officesProviders = createResourceProviders(officesResource);
