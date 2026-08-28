import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoggingService } from '../logging/logging.service';
import type { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggingService: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest & Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttpException
      ? this.httpMessage(exception)
      : 'Internal server error';
    const error = exception instanceof Error ? exception : undefined;

    this.loggingService.logError({
      method: request.method,
      path: request.path,
      statusCode: status,
      message: isHttpException ? message : error?.message ?? 'Unknown exception',
      userId: request.user?.id,
      exceptionName: error?.name,
      stack: isHttpException ? undefined : error?.stack,
    });

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message,
        path: request.path,
      },
    });
  }

  private httpMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const { message } = response as { message: string | string[] };
      return message;
    }

    return exception.message;
  }
}
