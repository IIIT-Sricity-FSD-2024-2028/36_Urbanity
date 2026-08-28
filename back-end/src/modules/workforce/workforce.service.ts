import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { CreateWorkerProfileDto, WorkerProfile, WorkerStatus, UpdateWorkerProfileDto } from './workforce.dto';

const seededAt = '2026-01-01T00:00:00.000Z';
const profiles: WorkerProfile[] = [
  ['50000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '10000000-0000-4000-8000-000000000001', 'PLUMBING', WorkerStatus.Available],
  ['50000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', '10000000-0000-4000-8000-000000000001', 'ELECTRICAL', WorkerStatus.Available],
  ['50000000-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6', '10000000-0000-4000-8000-000000000001', 'LIFT_MAINTENANCE', WorkerStatus.Available],
  ['50000000-0000-4000-8000-000000000004', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7', '10000000-0000-4000-8000-000000000001', 'HVAC', WorkerStatus.OnLeave],
  ['50000000-0000-4000-8000-000000000005', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5', '10000000-0000-4000-8000-000000000002', 'PLUMBING', WorkerStatus.Available],
].map(([id, userId, communityId, specialization, status]) => ({ id, userId, communityId, specialization: specialization as any, status: status as WorkerStatus, rating: 0, completedWorkCount: 0, workHistory: [], createdAt: seededAt, updatedAt: seededAt }));

@Injectable()
export class WorkforceService {
  private readonly repository = new CrudRepository<WorkerProfile>(profiles);
  private readonly crud = new CrudService(this.repository, 'Worker profile');
  constructor(
    @Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>,
    private readonly community: CommunityService,
  ) {}
  findAll() { return this.crud.findAll(); }
  findById(id: string) { return this.crud.findById(id); }
  getWorkerProfileForUser(userId: string) {
    const user = this.users.findById(userId);
    if (user.role !== RoleName.MaintenanceWorker) {
      throw new ForbiddenException('Only Maintenance Workers have worker profiles');
    }
    const profiles = this.findAll().filter((item) => item.userId === userId);
    if (profiles.length !== 1) {
      throw new BadRequestException('A Maintenance Worker must have exactly one worker profile');
    }

    const profile = profiles[0];
    if (profile.communityId !== user.communityId) throw new BadRequestException('Worker profile community must match its user');
    return profile;
  }
  assertValidAssignmentTarget(id: string) {
    const profile = this.findById(id);
    const user = this.users.findById(profile.userId);
    if (user.role !== RoleName.MaintenanceWorker) {
      throw new BadRequestException('Worker profiles require a MAINTENANCE_WORKER user');
    }
    if (profile.communityId !== user.communityId) throw new BadRequestException('Worker profile community must match its user');
    return profile;
  }
  findOwn(actor: AuthenticatedUser) {
    return this.getWorkerProfileForUser(actor.id);
  }
  findByIdForActor(actor: AuthenticatedUser, id: string) {
    const profile = this.findById(id);
    this.assertCanAccessProfile(actor, profile);
    return profile;
  }
  findAllForActor(actor: AuthenticatedUser) {
    if (actor.role === RoleName.SuperAdmin) return this.findAll();
    if (![RoleName.CommunityAdmin, RoleName.TowerRepresentative].includes(actor.role)) {
      throw new ForbiddenException('You do not have access to worker profiles');
    }
    const communityId = this.actorCommunityId(actor);
    return this.findAll().filter((profile) => profile.communityId === communityId);
  }
  create(dto: CreateWorkerProfileDto) {
    const user = this.users.findById(dto.userId);
    if (user.role !== RoleName.MaintenanceWorker) throw new BadRequestException('Worker profiles require a MAINTENANCE_WORKER user');
    if (this.findAll().some((profile) => profile.userId === dto.userId)) throw new BadRequestException('A worker profile already exists for this user');
    const now = new Date().toISOString();
    if (!user.communityId) throw new BadRequestException('MAINTENANCE_WORKER users require a community association');
    return this.crud.create({ ...dto, communityId: user.communityId, status: dto.status ?? WorkerStatus.Available, rating: 0, completedWorkCount: 0, workHistory: [], createdAt: now, updatedAt: now });
  }
  createForActor(actor: AuthenticatedUser, dto: CreateWorkerProfileDto) {
    this.assertCanManageWorkerUser(actor, dto.userId);
    return this.create(dto);
  }
  update(id: string, dto: UpdateWorkerProfileDto) {
    const current = this.findById(id);
    if (dto.userId && dto.userId !== current.userId) throw new BadRequestException('A worker profile user cannot be changed');
    if (dto.status === WorkerStatus.Busy) throw new BadRequestException('BUSY status is managed by worker assignment operations');
    return this.crud.update(id, { specialization: dto.specialization ?? current.specialization, status: dto.status ?? current.status, updatedAt: new Date().toISOString() });
  }
  updateForActor(actor: AuthenticatedUser, id: string, dto: UpdateWorkerProfileDto) {
    this.assertCanAccessProfile(actor, this.findById(id));
    return this.update(id, dto);
  }
  updateSystemStatus(id: string, status: WorkerStatus) { return this.crud.update(id, { status, updatedAt: new Date().toISOString() }); }
  addCompletedComplaint(id: string, complaintId: string) {
    const worker = this.findById(id);
    return this.crud.update(id, { workHistory: [...worker.workHistory, complaintId], updatedAt: new Date().toISOString() });
  }
  updatePerformance(id: string, rating: number, completedWorkCount: number) {
    return this.crud.update(id, { rating, completedWorkCount, updatedAt: new Date().toISOString() });
  }
  deactivate(id: string) { return this.crud.update(id, { status: WorkerStatus.Inactive, updatedAt: new Date().toISOString() }); }
  deactivateForActor(actor: AuthenticatedUser, id: string) {
    this.assertCanAccessProfile(actor, this.findById(id));
    return this.deactivate(id);
  }
  private assertCanManageWorkerUser(actor: AuthenticatedUser, userId: string) {
    if (actor.role === RoleName.SuperAdmin) return;
    if (actor.role !== RoleName.CommunityAdmin) throw new ForbiddenException('Only Community Admins may manage worker profiles');
    const user = this.users.findById(userId);
    if (user.role !== RoleName.MaintenanceWorker) return;
    if (!user.communityId || user.communityId !== this.actorCommunityId(actor)) {
      throw new ForbiddenException('Community Admins may manage only workers in their own community');
    }
  }
  private assertCanAccessProfile(actor: AuthenticatedUser, profile: WorkerProfile) {
    if (actor.role === RoleName.SuperAdmin) return;
    if (actor.role === RoleName.MaintenanceWorker && profile.userId === actor.id) return;
    if ([RoleName.CommunityAdmin, RoleName.TowerRepresentative].includes(actor.role) && profile.communityId === this.actorCommunityId(actor)) return;
    throw new ForbiddenException('You do not have access to this worker profile');
  }
  private actorCommunityId(actor: AuthenticatedUser) {
    const user = this.users.findById(actor.id);
    if (user.communityId) return user.communityId;
    if (user.towerId) return this.community.getTower(user.towerId).communityId;
    throw new ForbiddenException('The authenticated user has no community association');
  }
}
