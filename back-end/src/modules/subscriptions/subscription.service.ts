import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { PaymentStatus, RequestUpgradeDto, Subscription, SubscriptionStatus } from './subscription.dto';

export const TOWER_RATE = 1000;
export const APARTMENT_RATE = 10;

@Injectable()
export class SubscriptionService {
  private readonly repository = new CrudRepository<Subscription>();
  private readonly crud = new CrudService(this.repository, 'Subscription');

  constructor(@Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>) {}

  createPending(communityId: string, communityName: string, contractedTowers: number, contractedApartments: number) {
    const now = new Date().toISOString();
    return this.crud.create({ communityId, communityName, contractedTowers, contractedApartments, towerRate: TOWER_RATE, apartmentRate: APARTMENT_RATE, amount: contractedTowers * TOWER_RATE + contractedApartments * APARTMENT_RATE, status: SubscriptionStatus.PaymentPending, paymentStatus: PaymentStatus.Pending, createdAt: now, updatedAt: now });
  }

  delete(id: string) { return this.crud.delete(id); }
  findByCommunityId(communityId: string) { return this.crud.findAll().find((item) => item.communityId === communityId); }
  listForSuperAdmin(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.SuperAdmin) throw new ForbiddenException('Only Super Admins can list subscriptions');
    return this.crud.findAll();
  }
  getForActor(actor: AuthenticatedUser) { return this.requireForActor(actor); }
  completeMockPayment(actor: AuthenticatedUser) {
    const subscription = this.requireForActor(actor);
    if (subscription.status === SubscriptionStatus.Active) return subscription;
    return this.crud.update(subscription.id, { status: SubscriptionStatus.Active, paymentStatus: PaymentStatus.Success, updatedAt: new Date().toISOString() });
  }
  requestUpgrade(actor: AuthenticatedUser, dto: RequestUpgradeDto) {
    const subscription = this.requireForActor(actor);
    if (subscription.status !== SubscriptionStatus.Active) throw new ForbiddenException('Complete the current payment before upgrading the plan');
    if (dto.contractedTowers < subscription.contractedTowers || dto.contractedApartments < subscription.contractedApartments) throw new ForbiddenException('A plan upgrade cannot reduce contracted capacity');
    if (dto.contractedTowers === subscription.contractedTowers && dto.contractedApartments === subscription.contractedApartments) throw new ForbiddenException('Choose a higher tower or apartment capacity');
    const pendingUpgradeAmount = (dto.contractedTowers - subscription.contractedTowers) * subscription.towerRate + (dto.contractedApartments - subscription.contractedApartments) * subscription.apartmentRate;
    return this.crud.update(subscription.id, { pendingContractedTowers: dto.contractedTowers, pendingContractedApartments: dto.contractedApartments, pendingUpgradeAmount, updatedAt: new Date().toISOString() });
  }
  completeMockUpgrade(actor: AuthenticatedUser) {
    const subscription = this.requireForActor(actor);
    if (!subscription.pendingContractedTowers || !subscription.pendingContractedApartments || !subscription.pendingUpgradeAmount) throw new ForbiddenException('No plan upgrade is awaiting payment');
    const amount = subscription.pendingContractedTowers * subscription.towerRate + subscription.pendingContractedApartments * subscription.apartmentRate;
    return this.crud.update(subscription.id, { contractedTowers: subscription.pendingContractedTowers, contractedApartments: subscription.pendingContractedApartments, amount, pendingContractedTowers: undefined, pendingContractedApartments: undefined, pendingUpgradeAmount: undefined, paymentStatus: PaymentStatus.Success, updatedAt: new Date().toISOString() });
  }
  assertCommunityActive(communityId: string) {
    const subscription = this.findByCommunityId(communityId);
    if (subscription && subscription.status !== SubscriptionStatus.Active) throw new ForbiddenException('Community setup is unavailable until payment is completed');
  }
  assertCapacityForTowers(communityId: string, count: number) {
    const subscription = this.findByCommunityId(communityId);
    if (subscription && count > subscription.contractedTowers) throw new ForbiddenException('Contracted tower capacity has been reached');
  }
  assertCapacityForApartments(communityId: string, count: number) {
    const subscription = this.findByCommunityId(communityId);
    if (subscription && count > subscription.contractedApartments) throw new ForbiddenException('Contracted apartment capacity has been reached');
  }
  private requireForActor(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.CommunityAdmin) throw new ForbiddenException('Only Community Admins can access their subscription');
    const user = this.users.findById(actor.id);
    if (!user.communityId) throw new ForbiddenException('Community Admin is missing a community association');
    const subscription = this.findByCommunityId(user.communityId);
    if (!subscription) throw new ForbiddenException('Community subscription was not found');
    return subscription;
  }
}
