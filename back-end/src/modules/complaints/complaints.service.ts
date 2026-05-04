import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const complaintsResource = resourceByName('complaints');
export const complaintsProviders = createResourceProviders(complaintsResource);
