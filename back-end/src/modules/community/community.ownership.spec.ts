import { BadRequestException } from '@nestjs/common';
import { RoleName } from '../../common/enums/roles.enum';
import { CommunityService } from './community.service';

describe('CommunityService apartment ownership transfers', () => {
  const communityId = '10000000-0000-4000-8000-000000000001';
  const apartmentId = '40000000-0000-4000-8000-000000000011';
  const ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  const users = new Map<string, any>([
    ['admin', { id: 'admin', role: RoleName.CommunityAdmin, communityId }],
    [ownerId, { id: ownerId, role: RoleName.Resident, communityId }],
    ['cross-community', { id: 'cross-community', role: RoleName.Resident, communityId: '10000000-0000-4000-8000-000000000002' }],
  ]);
  const usersService: any = { findById: (id: string) => { const value = users.get(id); if (!value) throw new Error('missing user'); return value; }, findAll: () => [...users.values()] };
  const subscriptions: any = { assertCommunityActive: jest.fn(), assertCapacityForApartments: jest.fn(), assertCapacityForTowers: jest.fn(), createPending: jest.fn() };
  const admin = { id: 'admin', role: RoleName.CommunityAdmin } as any;

  it('records explicit same-community transfers and leaves unrelated apartment edits ownership-neutral', () => {
    const service = new CommunityService(usersService, subscriptions);
    const transfer = service.transferApartmentOwnershipForActor(admin, apartmentId, { expectedOwnerUserId: null, newOwnerUserId: ownerId, reason: 'Sale completed', effectiveDate: '2026-10-01' });
    expect(transfer.fromOwnerUserId).toBeNull();
    expect(transfer.toOwnerUserId).toBe(ownerId);
    service.updateApartmentForActor(admin, apartmentId, { label: 'Updated apartment label' });
    expect(service.getApartment(apartmentId).ownerUserId).toBe(ownerId);
    expect(service.apartmentOwnershipHistoryForActor(admin, apartmentId)).toEqual([transfer]);
    expect(() => service.transferApartmentOwnershipForActor(admin, apartmentId, { expectedOwnerUserId: null, newOwnerUserId: ownerId, reason: 'Repeat', effectiveDate: '2026-10-01' })).toThrow(BadRequestException);
    expect(() => service.transferApartmentOwnershipForActor(admin, apartmentId, { expectedOwnerUserId: ownerId, newOwnerUserId: 'cross-community', reason: 'Invalid', effectiveDate: '2026-10-01' })).toThrow(BadRequestException);
    expect(() => service.updateApartmentForActor(admin, apartmentId, { ownerUserId: null } as any)).toThrow(/explicit ownership-transfer/);
  });
});
