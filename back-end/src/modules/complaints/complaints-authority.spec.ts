import { beforeEach, describe, expect, it } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { ComplaintStatus } from '../../common/enums/status.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { UserAccessService } from '../users/user-access.service';
import { ComplaintsModule } from './complaints.module';
import { ComplaintsService } from './complaints.service';

const actor = (id: string): AuthenticatedUser => ({ id, email: `${id}@test.local`, role: RoleName.TowerRepresentative });
const towerARepresentative = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1');
const towerBRepresentative = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8');
const TOWER_A = '20000000-0000-4000-8000-000000000001';
const TOWER_B = '20000000-0000-4000-8000-000000000002';
const TOWER_A_COMPLAINT = '60000000-0000-4000-8000-000000000001';
const toReview = { status: ComplaintStatus.UnderReview };

describe('Tower Representative complaint authority', () => {
  let complaints: ComplaintsService;
  let users: CrudService<User, any, any>;
  let community: CommunityService;
  let userAccess: UserAccessService;
  const superAdmin: AuthenticatedUser = { id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', email: 'superadmin@urbanity.local', role: RoleName.SuperAdmin };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ComplaintsModule] }).compile();
    complaints = moduleRef.get(ComplaintsService);
    users = moduleRef.get(serviceToken('users'));
    community = moduleRef.get(CommunityService);
    userAccess = moduleRef.get(UserAccessService);
  });

  it('allows only one Tower Representative per tower', () => {
    expect(() => community.associateRepresentative(superAdmin, towerBRepresentative.id, { towerId: TOWER_A })).toThrow('already has a Tower Representative');
    expect(() => userAccess.create(superAdmin, { name: 'Second Rep', email: 'second.rep@urbanity.local', password: 'second-rep-dev', role: RoleName.TowerRepresentative, towerId: TOWER_A } as any)).toThrow('already has a Tower Representative');
    expect(() => userAccess.update(superAdmin, towerBRepresentative.id, { towerId: TOWER_A } as any)).toThrow('already has a Tower Representative');
    expect(community.associateRepresentative(superAdmin, towerARepresentative.id, { towerId: TOWER_A }).towerId).toBe(TOWER_A);
    expect(community.associateRepresentative(superAdmin, towerARepresentative.id, { towerId: '20000000-0000-4000-8000-000000000003' }).towerId).toBe('20000000-0000-4000-8000-000000000003');
  });

  it('acts only through the representative of the complaint tower', () => {
    expect(() => complaints.transitionStatus(TOWER_A_COMPLAINT, toReview, towerBRepresentative)).toThrow(ForbiddenException);
    expect(complaints.transitionStatus(TOWER_A_COMPLAINT, toReview, towerARepresentative).status).toBe(ComplaintStatus.UnderReview);
  });

  it('removes authority from a representative moved to another tower', () => {
    users.update(towerARepresentative.id, { towerId: TOWER_B });
    expect(() => complaints.transitionStatus(TOWER_A_COMPLAINT, toReview, towerARepresentative)).toThrow(ForbiddenException);
    expect(() => complaints.eligibleWorkers(towerARepresentative, TOWER_A_COMPLAINT)).toThrow(ForbiddenException);
  });

  it('hands existing complaints to the tower current representative', () => {
    users.update(towerARepresentative.id, { towerId: TOWER_B });
    users.update(towerBRepresentative.id, { towerId: TOWER_A });
    expect(complaints.findByIdForActor(towerBRepresentative, TOWER_A_COMPLAINT)).toMatchObject({ responsibleUserId: towerBRepresentative.id, responsibleUserName: 'Sana Iyer' });
    expect(complaints.transitionStatus(TOWER_A_COMPLAINT, toReview, towerBRepresentative).status).toBe(ComplaintStatus.UnderReview);
    expect(complaints.findById(TOWER_A_COMPLAINT).responsibleUserId).toBe(towerARepresentative.id);
  });
});
