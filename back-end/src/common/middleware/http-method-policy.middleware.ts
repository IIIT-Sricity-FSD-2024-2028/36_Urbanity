import {
  Injectable,
  MethodNotAllowedException,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const DISALLOWED_METHODS = new Set(['CONNECT', 'TRACE']);

/** Blocks HTTP methods that Urbanity does not expose or need. */
@Injectable()
export class HttpMethodPolicyMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    if (DISALLOWED_METHODS.has(request.method)) {
      throw new MethodNotAllowedException('HTTP method is not allowed');
    }

    next();
  }
}
