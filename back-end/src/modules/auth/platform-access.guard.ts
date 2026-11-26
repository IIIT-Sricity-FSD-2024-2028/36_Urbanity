import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CrudService } from '../../common/crud/crud.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { RoleName } from '../../common/enums/roles.enum';
import type { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import { CommunityService } from '../community/community.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import type { AuthenticatedUser } from './interfaces/auth.interface';

const ALLOW_PAYMENT_PENDING = 'allowPaymentPending';
export const AllowPaymentPending = () => SetMetadata(ALLOW_PAYMENT_PENDING, true);

@Injectable()
export class PlatformAccessService {
  constructor(
    @Inject(serviceToken('users')) private readonly users: CrudService<User, Partial<User>, Partial<User>>,
    private readonly communities: CommunityService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  requiresPayment(actor: AuthenticatedUser) {
    if (actor.role === RoleName.SuperAdmin) return false;
    const user = this.users.findById(actor.id);
    const communityId = this.communityId(user);
    if (!communityId) return Boolean(user.registrationApplicationId);
    const subscription = this.subscriptions.findByCommunityId(communityId);
    if (user.registrationApplicationId && subscription?.registrationApplicationId !== user.registrationApplicationId) return true;
    if (!subscription) return Boolean(this.communities.listCommunities().find(({ id }) => id === communityId)?.registrationApplicationId);
    return this.subscriptions.requiresPayment(communityId);
  }

  private communityId(user: User) {
    if (user.role === RoleName.CommunityAdmin || user.role === RoleName.MaintenanceWorker) return user.communityId;
    let towerId = user.towerId;
    if (user.role === RoleName.Resident) {
      const apartment = this.communities.listApartments().find(({ id }) => id === user.apartmentId);
      towerId = this.communities.listFloors().find(({ id }) => id === apartment?.floorId)?.towerId;
    }
    return this.communities.listTowers().find(({ id }) => id === towerId)?.communityId;
  }
}

@Injectable()
export class PlatformAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly access: PlatformAccessService) {}

  canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)
      || this.reflector.getAllAndOverride<boolean>(ALLOW_PAYMENT_PENDING, targets)) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || this.access.requiresPayment(user)) {
      throw new ForbiddenException('Complete the outstanding platform payment to access community operations');
    }
    return true;
  }
}
