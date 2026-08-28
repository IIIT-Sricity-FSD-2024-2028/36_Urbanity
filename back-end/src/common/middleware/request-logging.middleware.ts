import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly loggingService: LoggingService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = performance.now();

    response.once('finish', () => {
      const authenticatedRequest = request as AuthenticatedRequest;
      this.loggingService.logRequest({
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        userId: authenticatedRequest.user?.id,
      });
    });

    next();
  }
}
