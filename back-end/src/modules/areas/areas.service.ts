import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const areasResource = resourceByName('areas');
export const areasProviders = createResourceProviders(areasResource);
