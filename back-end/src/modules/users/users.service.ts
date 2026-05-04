import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const usersResource = resourceByName('users');
export const usersProviders = createResourceProviders(usersResource);
