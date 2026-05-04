import { createResourceProviders } from '../../common/crud/resource-module.factory';
import { resourceByName } from '../../data/urbanity.resources';

export const feedbackResource = resourceByName('feedback');
export const feedbackProviders = createResourceProviders(feedbackResource);
