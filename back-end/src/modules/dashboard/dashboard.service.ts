import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { ComplaintsService } from '../complaints/complaints.service';
import { ComplaintStatus } from '../../common/enums/status.enum';
import { ComplaintType } from '../complaints/complaints.dto';
import { WorkforceService } from '../workforce/workforce.service';
import { WorkerStatus } from '../workforce/workforce.dto';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>,
    private readonly community: CommunityService,
    private readonly complaints: ComplaintsService,
    private readonly workforce: WorkforceService,
  ) {}
  getSummary(actor: AuthenticatedUser) {
    if (![RoleName.SuperAdmin, RoleName.CommunityAdmin].includes(actor.role)) throw new ForbiddenException('Only Super Admins and Community Admins may view dashboard metrics');
    const communityId = actor.role === RoleName.SuperAdmin ? undefined : this.actorCommunityId(actor);
    const towers = this.community.listTowers().filter((tower) => !communityId || tower.communityId === communityId);
    const towerIds = new Set(towers.map((tower) => tower.id));
    const floors = this.community.listFloors().filter((floor) => towerIds.has(floor.towerId));
    const floorIds = new Set(floors.map((floor) => floor.id));
    const apartments = this.community.listApartments().filter((apartment) => floorIds.has(apartment.floorId));
    const complaints = this.complaints.findAllForActor(actor);
    const workers = this.workforce.findAllForActor(actor);
    const users = this.users.findAll().filter((user) => !communityId || this.userCommunityId(user) === communityId);
    return {
      ...(communityId ? { communityId } : {}),
      hierarchy: { communities: communityId ? 1 : this.community.listCommunities().length, towers: towers.length, floors: floors.length, apartments: apartments.length },
      users: this.countBy(users, (user) => user.role),
      complaints: {
        total: complaints.length,
        byStatus: this.countBy(complaints, (complaint) => complaint.status, Object.values(ComplaintStatus)),
        byType: this.countBy(complaints, (complaint) => complaint.type, Object.values(ComplaintType)),
      },
      workforce: {
        total: workers.length,
        byStatus: this.countBy(workers, (worker) => worker.status, Object.values(WorkerStatus)),
        completedWorkCount: workers.reduce((total, worker) => total + worker.completedWorkCount, 0),
        averageRating: workers.length ? Number((workers.reduce((total, worker) => total + worker.rating, 0) / workers.length).toFixed(2)) : 0,
      },
    };
  }
  private actorCommunityId(actor: AuthenticatedUser) {
    const user = this.users.findById(actor.id);
    if (!user.communityId) throw new ForbiddenException('Community Admin is missing a community association');
    return user.communityId;
  }
  private userCommunityId(user: User) {
    if (user.communityId) return user.communityId;
    if (user.towerId) return this.community.getTower(user.towerId).communityId;
    if (user.apartmentId) return this.community.getTower(this.community.getFloor(this.community.getApartment(user.apartmentId).floorId).towerId).communityId;
    return undefined;
  }
  private countBy<T>(items: T[], key: (item: T) => string, expected: string[] = []) {
    const counts: Record<string, number> = Object.fromEntries(expected.map((value) => [value, 0]));
    for (const item of items) {
      const value = key(item);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
  }
}
