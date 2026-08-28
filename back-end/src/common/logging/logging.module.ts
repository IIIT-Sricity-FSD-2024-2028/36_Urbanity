import { Module } from '@nestjs/common';
import { join } from 'node:path';
import { LOG_DIRECTORY } from './logging.constants';
import { LoggingService } from './logging.service';

@Module({
  providers: [
    {
      provide: LOG_DIRECTORY,
      useFactory: () => process.env.LOG_DIRECTORY ?? join(process.cwd(), 'logs'),
    },
    LoggingService,
  ],
  exports: [LoggingService],
})
export class LoggingModule {}
