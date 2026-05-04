import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const citiesResource = resourceByName('cities');
export const citiesProviders = createResourceProviders(citiesResource);
