import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { feedbackResource } from './feedback.service';

export const FeedbackController = createUrbanityController(feedbackResource);
