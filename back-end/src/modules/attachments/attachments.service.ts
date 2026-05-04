import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const attachmentsResource = resourceByName('attachments');
export const attachmentsProviders =
  createResourceProviders(attachmentsResource);
