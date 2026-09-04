import { describe, expect, it, jest } from '@jest/globals';
import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  it('adds a server-generated correlation ID to the response', () => {
    const middleware = new RequestIdMiddleware();
    const next = jest.fn();
    const setHeader = jest.fn();
    const response = { locals: {}, setHeader } as any;

    middleware.use({} as any, response, next);

    expect(response.locals.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      response.locals.requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
