import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { HttpExceptionFilter } from './http-exception.filter';

const createHost = (request: { method: string; path: string; user?: { id: string } }) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    } as any,
    status,
    json,
  };
};

describe('HttpExceptionFilter', () => {
  it('formats and logs HttpExceptions with safe request metadata', () => {
    const loggingService = { logError: jest.fn() } as any;
    const filter = new HttpExceptionFilter(loggingService);
    const { host, status, json } = createHost({
      method: 'POST',
      path: '/cities',
      user: { id: 'user-1' },
    });

    filter.catch(new BadRequestException(['name must not be empty']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        statusCode: 400,
        message: ['name must not be empty'],
        path: '/cities',
      },
    });
    expect(loggingService.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        userId: 'user-1',
        message: ['name must not be empty'],
      }),
    );
  });

  it('hides unexpected exception details from the HTTP response', () => {
    const loggingService = { logError: jest.fn() } as any;
    const filter = new HttpExceptionFilter(loggingService);
    const { host, status, json } = createHost({
      method: 'GET',
      path: '/internal-test',
    });

    filter.catch(new Error('database password=secret'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        statusCode: 500,
        message: 'Internal server error',
        path: '/internal-test',
      },
    });
    expect(loggingService.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        exceptionName: 'Error',
      }),
    );
  });
});
