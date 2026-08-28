import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleName } from '../enums/roles.enum';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';

const READ_METHODS = new Set(['GET']);
const SUPPORTED_ROLES = new Set<string>(Object.values(RoleName));

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const role = request.user?.role;

    if (!role || !SUPPORTED_ROLES.has(role)) {
      throw new ForbiddenException('Invalid authenticated role');
    }

    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length) {
      if (!requiredRoles.includes(role)) {
        throw new ForbiddenException('Insufficient role permissions');
      }

      return true;
    }

    if (role === RoleName.CommunityAdmin) {
      return true;
    }

    if (READ_METHODS.has(request.method)) {
      return true;
    }

    throw new ForbiddenException('Insufficient role permissions');
  }
}
