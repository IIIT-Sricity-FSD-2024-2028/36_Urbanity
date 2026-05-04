import { Module } from '@nestjs/common';
import { FeedbackController } from './feedback.controller';
import { feedbackProviders } from './feedback.service';

@Module({
  controllers: [FeedbackController],
  providers: feedbackProviders,
})
export class FeedbackModule {}
