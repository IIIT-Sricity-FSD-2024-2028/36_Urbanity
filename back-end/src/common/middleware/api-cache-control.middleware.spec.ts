import { describe, expect, it, jest } from '@jest/globals';
import { ApiCacheControlMiddleware } from './api-cache-control.middleware';

describe('ApiCacheControlMiddleware', () => {
  it('prevents API responses from being stored', () => {
    const middleware = new ApiCacheControlMiddleware();
    const next = jest.fn();
    const setHeader = jest.fn();

    middleware.use({} as any, { setHeader } as any, next);

    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
