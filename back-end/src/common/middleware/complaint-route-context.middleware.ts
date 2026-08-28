import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ComplaintRouteContextMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const complaintId = request.params.id ?? request.params.complaintId;

    if (
      complaintId &&
      (typeof complaintId !== 'string' || !UUID_V4_PATTERN.test(complaintId))
    ) {
      throw new BadRequestException('Invalid complaint ID');
    }

    next();
  }
}
