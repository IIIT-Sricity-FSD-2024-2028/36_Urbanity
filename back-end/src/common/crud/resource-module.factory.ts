import { Provider } from '@nestjs/common';
import { CrudRepository } from './crud.repository';
import { CrudService } from './crud.service';
import {
  ResourceDefinition,
  repositoryToken,
  serviceToken,
} from '../../data/urbanity.resources';

export const createResourceProviders = (
  resource: ResourceDefinition,
): Provider[] => [
  {
    provide: repositoryToken(resource.name),
    useFactory: () => new CrudRepository(resource.seedData ?? []),
  },
  {
    provide: serviceToken(resource.name),
    useFactory: (repository: CrudRepository<any>) =>
      new CrudService(repository, resource.label, resource.defaults),
    inject: [repositoryToken(resource.name)],
  },
];
