import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { attachmentsProviders } from './attachments.service';

@Module({
  controllers: [AttachmentsController],
  providers: attachmentsProviders,
})
export class AttachmentsModule {}
