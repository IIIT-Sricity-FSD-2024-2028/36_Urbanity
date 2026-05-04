import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RoleName } from '../enums/roles.enum';

const READ_METHODS = new Set(['GET']);
const SUPPORTED_ROLES = new Set<string>(Object.values(RoleName));

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const roleHeader = request.header('role');

    if (!roleHeader) {
      throw new ForbiddenException('Missing role header');
    }

    const role = roleHeader.toLowerCase();

    if (!SUPPORTED_ROLES.has(role)) {
      throw new ForbiddenException('Invalid role');
    }

    if (role === RoleName.Admin) {
      return true;
    }

    if (READ_METHODS.has(request.method)) {
      return true;
    }

    throw new ForbiddenException('Insufficient role permissions');
  }
}
