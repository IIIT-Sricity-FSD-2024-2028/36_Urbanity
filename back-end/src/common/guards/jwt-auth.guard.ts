import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { CrudService } from '../crud/crud.service';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';

interface JwtPayload {
  sub: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @Inject(serviceToken('users'))
    private readonly usersService: CrudService<
      User,
      Partial<User>,
      Partial<User>
    >,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = this.usersService
        .findAll()
        .find((item) => item.id === payload.sub);

      if (!user) throw new UnauthorizedException('Invalid authentication token');

      request.user = { id: user.id, email: user.email, role: user.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractBearerToken(authorization?: string): string {
    const [scheme, token, ...extra] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token || extra.length > 0) {
      throw new UnauthorizedException('Authentication token is required');
    }

    return token;
  }
}
