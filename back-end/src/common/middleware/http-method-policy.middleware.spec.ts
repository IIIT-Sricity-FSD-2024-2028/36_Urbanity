import { MethodNotAllowedException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { HttpMethodPolicyMiddleware } from './http-method-policy.middleware';

describe('HttpMethodPolicyMiddleware', () => {
  const middleware = new HttpMethodPolicyMiddleware();

  it.each(['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'])(
    'continues supported %s requests',
    (method) => {
      const next = jest.fn();

      middleware.use({ method } as any, {} as any, next);

      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['CONNECT', 'TRACE'])('rejects unsafe %s requests', (method) => {
    expect(() =>
      middleware.use({ method } as any, {} as any, jest.fn()),
    ).toThrow(MethodNotAllowedException);
  });
});
