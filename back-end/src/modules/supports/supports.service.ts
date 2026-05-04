import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const supportsResource = resourceByName('supports');
export const supportsProviders = createResourceProviders(supportsResource);
