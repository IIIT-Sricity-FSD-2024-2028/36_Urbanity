import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { CreateUserDto, UpdateUserDto, User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { SubscriptionService } from '../subscriptions/subscription.service';

@Injectable()
export class UserAccessService {
  constructor(@Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>, private readonly community: CommunityService, private readonly subscriptions: SubscriptionService) {}
  list(actor: AuthenticatedUser) { return this.users.findAll().filter((user) => actor.role === RoleName.SuperAdmin || this.communityIdFor(user) === this.actorCommunity(actor)).map((user) => this.safe(user)); }
  get(actor: AuthenticatedUser, id: string) { const user = this.users.findById(id); this.assertAccess(actor, user); return this.safe(user); }
  create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const requested = { ...dto, email: dto.email.trim().toLowerCase() };
    this.assertUniqueEmail(requested.email);
    this.assertCreateRole(actor, requested.role);
    const scoped = this.applyActorScope(actor, requested);
    this.validate(scoped);
    if (scoped.communityId) this.subscriptions.assertCommunityActive(scoped.communityId);
    if (scoped.towerId) this.subscriptions.assertCommunityActive(this.community.getTower(scoped.towerId).communityId);
    if (scoped.apartmentId) this.subscriptions.assertCommunityActive(this.community.getTower(this.community.getFloor(this.community.getApartment(scoped.apartmentId).floorId).towerId).communityId);
    if (scoped.role === RoleName.Resident && scoped.residentSituation === 'OWNER_OCCUPANT') this.community.assertOwnerAssignment(scoped.apartmentId);
    const { password, ...account } = scoped;
    const created = this.users.create({ ...account, ...(scoped.role === RoleName.Resident ? {residentSituation: scoped.residentSituation ?? 'TENANT_PENDING'} : {}), passwordHash: hashSync(password, 10), createdAt: new Date().toISOString() });
    if (created.role === RoleName.Resident && created.residentSituation === 'OWNER_OCCUPANT') {
      try { this.community.transferApartmentOwnershipForActor(actor, created.apartmentId!, {expectedOwnerUserId:null,newOwnerUserId:created.id,reason:'Owner-occupant onboarding',effectiveDate:new Date().toISOString().slice(0,10)}); }
      catch(error) { this.users.delete(created.id); throw error; }
    }
    return this.safe(created);
  }
  update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    dto=Object.fromEntries(Object.entries(dto).filter(([,value])=>value!==undefined));
    const current = this.users.findById(id); this.assertAccess(actor, current);
    if (current.registrationApplicationId) {
      const identityChange = ['role','communityId','towerId','apartmentId'].some(key => key in dto) || ('email' in dto && dto.email?.trim().toLowerCase() !== current.email.toLowerCase());
      const ownActiveProfile = actor.id === id && actor.role === RoleName.CommunityAdmin && current.accountState === 'ACTIVE';
      if (identityChange || ('password' in dto && !ownActiveProfile)) throw new ForbiddenException('Registration account identity and scope use the onboarding workflow; only the active account owner may change their password');
    }
    if ('residentSituation' in dto) throw new BadRequestException('Occupancy changes require rental or ownership workflows');
    if ('role' in dto || 'apartmentId' in dto || 'communityId' in dto) this.community.assertRentalUserChange(id, dto.apartmentId);
    if (actor.role === RoleName.CommunityAdmin && actor.id === id && ('role' in dto || 'communityId' in dto)) throw new ForbiddenException('Community Admins cannot change their own role or community');
    if (actor.role === RoleName.CommunityAdmin && 'role' in dto) throw new ForbiddenException('Community Admins cannot change user roles');
    const requested = { ...dto, ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}) };
    if (requested.email) this.assertUniqueEmail(requested.email, id);
    const next = this.applyActorScope(actor, { ...current, ...requested }); this.validate(next);
    const communityId = this.communityIdFor(next); if (communityId) this.subscriptions.assertCommunityActive(communityId);
    if (actor.role === RoleName.CommunityAdmin && this.communityIdFor(next) !== this.actorCommunity(actor)) throw new ForbiddenException('Users cannot be moved across communities');
    const { password, ...data } = requested; return this.safe(this.users.update(id, { ...data, ...(password ? { passwordHash: hashSync(password, 10) } : {}) }));
  }
  delete(actor: AuthenticatedUser, id: string) { this.community.assertRentalUserChange(id); const user = this.users.findById(id); this.assertAccess(actor, user); if (user.registrationApplicationId) throw new ForbiddenException('Registration-linked accounts must retain their onboarding records'); const communityId = this.communityIdFor(user); if (communityId) this.subscriptions.assertCommunityActive(communityId); if (actor.id === id) throw new ForbiddenException('Users cannot delete themselves'); return this.safe(this.users.delete(id)); }
  private actorCommunity(actor: AuthenticatedUser) { const user = this.users.findById(actor.id); if (!user.communityId) throw new ForbiddenException('Community Admin is missing a community association'); return user.communityId; }
  private communityIdFor(user: User) { if (user.communityId) return user.communityId; if (user.towerId) return this.community.getTower(user.towerId).communityId; if (user.apartmentId) return this.community.getTower(this.community.getFloor(this.community.getApartment(user.apartmentId).floorId).towerId).communityId; return undefined; }
  private assertAccess(actor: AuthenticatedUser, user: User) { if (actor.role !== RoleName.SuperAdmin && this.communityIdFor(user) !== this.actorCommunity(actor)) throw new ForbiddenException('User belongs to another community'); }
  private assertCreateRole(actor: AuthenticatedUser, role: RoleName) { if (actor.role === RoleName.SuperAdmin) return; if (actor.role !== RoleName.CommunityAdmin || ![RoleName.Resident, RoleName.TowerRepresentative, RoleName.MaintenanceWorker].includes(role)) throw new ForbiddenException('Community Admins may create only community residents, representatives, and maintenance workers'); }
  private assertUniqueEmail(email: string, excludedUserId?: string) { if (this.users.findAll().some((user) => user.id !== excludedUserId && user.email.toLowerCase() === email.toLowerCase())) throw new BadRequestException('A user with this email already exists'); }
  private applyActorScope(actor: AuthenticatedUser, user: any) { if (actor.role !== RoleName.CommunityAdmin) return user; const communityId = this.actorCommunity(actor); if (user.communityId && user.communityId !== communityId) throw new ForbiddenException('Client communityId does not match the authenticated Community Admin'); if (user.role === RoleName.MaintenanceWorker) user.communityId = communityId; if (user.towerId && this.community.getTower(user.towerId).communityId !== communityId) throw new ForbiddenException('Tower belongs to another community'); if (user.apartmentId && this.community.getTower(this.community.getFloor(this.community.getApartment(user.apartmentId).floorId).towerId).communityId !== communityId) throw new ForbiddenException('Apartment belongs to another community'); return user; }
  private validate(user: any) {
    const has = (field: string) => Boolean(user[field]);
    if (user.role === RoleName.SuperAdmin && (has('communityId') || has('towerId') || has('apartmentId'))) throw new BadRequestException('SUPER_ADMIN accounts cannot have hierarchy associations');
    if ([RoleName.CommunityAdmin, RoleName.MaintenanceWorker].includes(user.role)) {
      if (!has('communityId') || has('towerId') || has('apartmentId')) throw new BadRequestException(`${user.role} account associations are invalid`);
      this.community.getCommunity(user.communityId);
    }
    if (user.role === RoleName.TowerRepresentative) {
      if (!has('towerId') || has('communityId') || has('apartmentId')) throw new BadRequestException('TOWER_REPRESENTATIVE accounts use only a tower association');
      this.community.getTower(user.towerId);
      this.community.assertTowerHasNoOtherRepresentative(user.towerId, user.id);
    }
    if (user.role === RoleName.Resident) {
      if (!has('apartmentId') || has('communityId') || has('towerId')) throw new BadRequestException('RESIDENT accounts use only an apartment association');
      this.community.getApartment(user.apartmentId);
    }
  }
  private safe(user: User) { const { passwordHash: _passwordHash, password: _password, ...safe } = user as User & { password?: string }; return safe; }
}
