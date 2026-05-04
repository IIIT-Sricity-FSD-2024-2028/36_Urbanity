import { createUrbanityController } from '../../common/crud/crud.controller.factory';
import { attachmentsResource } from './attachments.service';

export const AttachmentsController =
  createUrbanityController(attachmentsResource);
