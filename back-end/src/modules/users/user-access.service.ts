import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { CreateUserDto, UpdateUserDto, User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';

@Injectable()
export class UserAccessService {
  constructor(@Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>, private readonly community: CommunityService) {}
  list(actor: AuthenticatedUser) { return this.users.findAll().filter((user) => actor.role === RoleName.SuperAdmin || this.communityIdFor(user) === this.actorCommunity(actor)).map((user) => this.safe(user)); }
  get(actor: AuthenticatedUser, id: string) { const user = this.users.findById(id); this.assertAccess(actor, user); return this.safe(user); }
  create(actor: AuthenticatedUser, dto: CreateUserDto) {
    this.assertCreateRole(actor, dto.role);
    const scoped = this.applyActorScope(actor, { ...dto });
    this.validate(scoped);
    return this.safe(this.users.create({ ...scoped, passwordHash: hashSync(scoped.password, 10), createdAt: new Date().toISOString() }));
  }
  update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const current = this.users.findById(id); this.assertAccess(actor, current);
    if (actor.role === RoleName.CommunityAdmin && actor.id === id && ('role' in dto || 'communityId' in dto)) throw new ForbiddenException('Community Admins cannot change their own role or community');
    if (actor.role === RoleName.CommunityAdmin && 'role' in dto) throw new ForbiddenException('Community Admins cannot change user roles');
    const next = this.applyActorScope(actor, { ...current, ...dto }); this.validate(next);
    if (actor.role === RoleName.CommunityAdmin && this.communityIdFor(next) !== this.actorCommunity(actor)) throw new ForbiddenException('Users cannot be moved across communities');
    const { password, ...data } = dto; return this.safe(this.users.update(id, { ...data, ...(password ? { passwordHash: hashSync(password, 10) } : {}) }));
  }
  delete(actor: AuthenticatedUser, id: string) { const user = this.users.findById(id); this.assertAccess(actor, user); if (actor.id === id) throw new ForbiddenException('Users cannot delete themselves'); return this.safe(this.users.delete(id)); }
  private actorCommunity(actor: AuthenticatedUser) { const user = this.users.findById(actor.id); if (!user.communityId) throw new ForbiddenException('Community Admin is missing a community association'); return user.communityId; }
  private communityIdFor(user: User) { if (user.communityId) return user.communityId; if (user.towerId) return this.community.getTower(user.towerId).communityId; if (user.apartmentId) return this.community.getTower(this.community.getFloor(this.community.getApartment(user.apartmentId).floorId).towerId).communityId; return undefined; }
  private assertAccess(actor: AuthenticatedUser, user: User) { if (actor.role !== RoleName.SuperAdmin && this.communityIdFor(user) !== this.actorCommunity(actor)) throw new ForbiddenException('User belongs to another community'); }
  private assertCreateRole(actor: AuthenticatedUser, role: RoleName) { if (actor.role === RoleName.SuperAdmin) return; if (actor.role !== RoleName.CommunityAdmin || ![RoleName.Resident, RoleName.TowerRepresentative, RoleName.MaintenanceWorker].includes(role)) throw new ForbiddenException('Community Admins may create only community residents, representatives, and maintenance workers'); }
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
    }
    if (user.role === RoleName.Resident) {
      if (!has('apartmentId') || has('communityId') || has('towerId')) throw new BadRequestException('RESIDENT accounts use only an apartment association');
      this.community.getApartment(user.apartmentId);
    }
  }
  private safe(user: User) { const { passwordHash: _passwordHash, ...safe } = user; return safe; }
}
