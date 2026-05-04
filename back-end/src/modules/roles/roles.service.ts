import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const rolesResource = resourceByName('roles');
export const rolesProviders = createResourceProviders(rolesResource);
