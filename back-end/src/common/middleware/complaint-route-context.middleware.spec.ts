import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { ComplaintRouteContextMiddleware } from './complaint-route-context.middleware';

const validId = '60000000-0000-4000-8000-000000000001';

describe('ComplaintRouteContextMiddleware', () => {
  const middleware = new ComplaintRouteContextMiddleware();

  const invoke = (params: Record<string, string>) => {
    const next = jest.fn();
    middleware.use({ params } as any, {} as any, next);
    return next;
  };

  it('continues valid complaint and nested complaint route identifiers', () => {
    expect(invoke({ id: validId })).toHaveBeenCalledTimes(1);
    expect(invoke({ complaintId: validId })).toHaveBeenCalledTimes(1);
  });

  it('continues complaint collection routes without an identifier', () => {
    expect(invoke({})).toHaveBeenCalledTimes(1);
  });

  it.each(['not-a-uuid', '123', 'abc'])('rejects invalid complaint identifiers', (id) => {
    expect(() => invoke({ id })).toThrow(BadRequestException);
  });

  it('rejects invalid nested complaint identifiers', () => {
    expect(() => invoke({ complaintId: 'not-a-uuid' })).toThrow(
      'Invalid complaint ID',
    );
  });
});
