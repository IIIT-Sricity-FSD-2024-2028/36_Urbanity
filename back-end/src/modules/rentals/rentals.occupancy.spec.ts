import { ConflictException, ForbiddenException } from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { CommunityService } from '../community/community.service';
import { UserAccessService } from '../users/user-access.service';
import { RentalsService } from './rentals.service';
import { OnboardTenantDto, UpdateListingDto } from './rentals.dto';
import { AmenitiesService } from '../amenities/amenities.service';

const A = '10000000-0000-4000-8000-000000000001';
const apartment = '40000000-0000-4000-8000-000000000011',
  otherApartment = '40000000-0000-4000-8000-000000000021';
const admin = {
    id: 'admin',
    name: 'Admin',
    email: 'admin@test.local',
    role: RoleName.CommunityAdmin,
  },
  owner = {
    id: 'owner',
    name: 'Owner',
    email: 'owner@test.local',
    role: RoleName.Resident,
  },
  tenant = {
    id: 'tenant',
    name: 'Tenant',
    email: 'tenant@test.local',
    role: RoleName.Resident,
  },
  outsider = {
    id: 'outsider',
    name: 'Outsider',
    email: 'outsider@test.local',
    role: RoleName.Resident,
  };

describe('F02 ownership, approvals and occupancy integration', () => {
  let users: CrudService<User, any, any>,
    community: CommunityService,
    rentals: RentalsService,
    accounts: UserAccessService;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-15T12:00:00Z'));
    users = new CrudService(
      new CrudRepository<User>([
        { ...admin, communityId: A, passwordHash: 'test', createdAt: '' },
        {
          ...owner,
          apartmentId: apartment,
          passwordHash: 'test',
          createdAt: '',
        },
        {
          ...tenant,
          apartmentId: '40000000-0000-4000-8000-000000000012',
          residentSituation: 'TENANT_PENDING',
          passwordHash: 'test',
          createdAt: '',
        },
        {
          ...outsider,
          apartmentId: '40000000-0000-4000-8000-000000000111',
          passwordHash: 'test',
          createdAt: '',
        },
      ]),
      'User',
    );
    const subscriptions: any = {
      assertCommunityActive: jest.fn(),
      assertCapacityForApartments: jest.fn(),
    };
    community = new CommunityService(users, subscriptions);
    accounts = new UserAccessService(users, community, subscriptions);
    rentals = new RentalsService(community, users, accounts);
    rentals.assignOwner(admin, apartment, owner.id);
  });
  afterEach(() => jest.useRealTimers());
  const terms = {
    apartmentId: apartment,
    arrangement: 'OWNER' as const,
    monthlyRent: 15000,
    securityDeposit: 30000,
    availableFrom: '2027-01-01',
    availableUntil: '2028-12-31',
  };
  const proposal = (startDate = '2027-01-01', endDate = '2027-03-31') => {
    const listing = rentals.createListing(admin, {
      ...terms,
      apartmentId: otherApartment,
      arrangement: 'COMMUNITY',
    });
    rentals.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = rentals.createLease(admin, {
      listingId: listing.id,
      tenantId: tenant.id,
      startDate,
      endDate,
      dueDay: 5,
    });
    return { listing, lease };
  };
  it('preserves owner-occupant access without rent and rejects private rentals', () => {
    expect(community.resolveResidentOccupancy(owner.id).apartment.id).toBe(
      apartment,
    );
    expect(rentals.myRentals(owner).leases).toHaveLength(0);
    expect(() => rentals.createListing(owner, terms)).toThrow(
      /Private rentals/,
    );
    expect(() => rentals.createListing(admin, terms)).toThrow(
      /Private rentals/,
    );
    expect(() =>
      rentals.createListing(admin, { ...terms, arrangement: 'COMMUNITY' }),
    ).toThrow(/Resident-owned/);
  });
  it('requires acceptance and admin activation, snapshots the payee and creates unique obligations', () => {
    const { lease } = proposal();
    expect(() => rentals.activateLease(admin, lease.id)).toThrow(/acceptance/);
    expect(() => community.resolveResidentOccupancy(tenant.id)).toThrow(
      ForbiddenException,
    );
    expect(() => rentals.activateLease(owner, lease.id)).toThrow(
      ForbiddenException,
    );
    rentals.acceptLease(tenant, lease.id);
    rentals.activateLease(admin, lease.id);
    rentals.activateLease(admin, lease.id);
    expect(community.resolveResidentOccupancy(tenant.id).apartment.id).toBe(
      otherApartment,
    );
    expect(community.getApartment(otherApartment).ownerUserId).toBeUndefined();
    expect(community.resolveResidentOccupancy(owner.id).apartment.id).toBe(
      apartment,
    );
    const first = rentals.myLease(tenant, lease.id),
      second = rentals.myLease(tenant, lease.id);
    expect(first.adminApprovedBy).toBe(admin.id);
    expect(first.payeeId).toBe(admin.id);
    expect(first.obligations).toHaveLength(1);
    expect(second.obligations.map((o) => o.id)).toEqual(
      first.obligations.map((o) => o.id),
    );
    expect(first.obligations.every((o) => o.payeeId === admin.id)).toBe(true);
    expect(first.payments).toHaveLength(0);
  });
  it('future and expired community leases grant no early or lingering access', () => {
    const { lease } = proposal('2027-02-01');
    rentals.acceptLease(tenant, lease.id);
    rentals.activateLease(admin, lease.id);
    expect(() => community.resolveResidentOccupancy(tenant.id)).toThrow();
    jest.setSystemTime(new Date('2027-02-15'));
    expect(community.resolveResidentOccupancy(tenant.id).apartment.id).toBe(
      otherApartment,
    );
    jest.setSystemTime(new Date('2027-04-01'));
    expect(() => community.resolveResidentOccupancy(tenant.id)).toThrow();
    expect(rentals.myLease(tenant, lease.id).status).toBe('EXPIRED');
    expect(
      rentals.inventory(admin).find((a) => a.id === otherApartment)?.occupancy,
    ).toBe('VACANT');
  });
  it('rejects overlapping leases, duplicate listings, and foreign tenants', () => {
    const { listing } = proposal();
    expect(() =>
      rentals.createListing(admin, {
        ...terms,
        apartmentId: otherApartment,
        arrangement: 'COMMUNITY',
      }),
    ).toThrow(/open rental listing/);
    expect(() =>
      rentals.createLease(admin, {
        listingId: listing.id,
        tenantId: tenant.id,
        startDate: '2027-02-01',
        endDate: '2027-04-01',
        dueDay: 5,
      }),
    ).toThrow();
    expect(rentals.managedLeases(admin)).toHaveLength(1);
    expect(() =>
      rentals.myLease(outsider, rentals.managedLeases(admin)[0].id),
    ).toThrow();
  });
  it('rejects a foreign resident without reserving the listing or creating another account', () => {
    const listing = rentals.createListing(admin, {
      ...terms,
      apartmentId: otherApartment,
      arrangement: 'COMMUNITY',
    });
    rentals.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    expect(() =>
      rentals.onboardTenant(admin, {
        listingId: listing.id,
        clientRequestId: 'foreign',
        existingTenantId: outsider.id,
        startDate: '2027-01-01',
        endDate: '2027-03-31',
        dueDay: 5,
      }),
    ).toThrow(/community/);
    expect(rentals.managedLeases(admin)).toHaveLength(0);
    expect(rentals.managed(admin)[0].status).toBe('AVAILABLE');
  });
  it('atomically creates tenants, rolls back failed leases and deduplicates retries', () => {
    const listing = rentals.createListing(admin, {
      ...terms,
      apartmentId: otherApartment,
      arrangement: 'COMMUNITY',
    });
    rentals.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const dto: OnboardTenantDto = {
      listingId: listing.id,
      clientRequestId: 'retry',
      account: {
        name: 'New tenant',
        email: 'new@test.local',
        password: 'typed-password',
        role: RoleName.Resident,
      },
      startDate: '2027-01-01',
      endDate: '2027-03-31',
      dueDay: 5,
    };
    const count = users.findAll().length;
    expect(() =>
      rentals.onboardTenant(admin, { ...dto, endDate: '2029-01-01' }),
    ).toThrow();
    expect(users.findAll()).toHaveLength(count);
    const lease = rentals.onboardTenant(admin, dto);
    expect(rentals.onboardTenant(admin, dto).id).toBe(lease.id);
    expect(users.findAll()).toHaveLength(count + 1);
    expect(users.findById(lease.tenantId)).not.toHaveProperty('password');
    expect(() => community.resolveResidentOccupancy(lease.tenantId)).toThrow();
    expect(() => rentals.onboardTenant(admin, { ...dto, dueDay: 10 })).toThrow(
      ConflictException,
    );
  });
  it('reuses an existing account without changing its identity or ownership', () => {
    const listing = rentals.createListing(admin, {
      ...terms,
      apartmentId: otherApartment,
      arrangement: 'COMMUNITY',
    });
    rentals.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const count = users.findAll().length,
      original = { ...users.findById(owner.id) };
    const lease = rentals.onboardTenant(admin, {
      listingId: listing.id,
      clientRequestId: 'existing',
      existingTenantId: owner.id,
      startDate: '2027-01-01',
      endDate: '2027-03-31',
      dueDay: 5,
    });
    expect(lease.tenantId).toBe(owner.id);
    expect(users.findAll()).toHaveLength(count);
    expect(users.findById(owner.id)).toEqual(original);
    expect(community.getApartment(apartment).ownerUserId).toBe(owner.id);
    rentals.acceptLease(owner, lease.id);
    rentals.activateLease(admin, lease.id);
    expect(community.resolveResidentOccupancy(owner.id).apartment.id).toBe(
      otherApartment,
    );
    expect(
      community.resolveResidentOccupancy(owner.id, apartment).apartment.id,
    ).toBe(apartment);
  });
  it('ends tenant access on termination without deleting financial history', () => {
    const { lease } = proposal();
    rentals.acceptLease(tenant, lease.id);
    rentals.activateLease(admin, lease.id);
    const bill = rentals.myLease(tenant, lease.id).obligations[0];
    const payment = rentals.requestPayment(tenant, lease.id, bill.id, {
      amount: 100,
      transactionReference: 'original',
    });
    rentals.verifyPayment(admin, payment.id);
    expect(() => accounts.delete(admin, tenant.id)).toThrow(ConflictException);
    const request = rentals.requestLifecycle(tenant, lease.id, 'TERMINATION');
    rentals.decideLifecycle(admin, request.id, 'APPROVED');
    expect(() => community.resolveResidentOccupancy(tenant.id)).toThrow();
    expect(rentals.myLease(tenant, lease.id).payments[0].id).toBe(payment.id);
    expect(rentals.myLease(tenant, lease.id).status).toBe('TERMINATED');
  });
  it('allows eligible tenant amenity bookings and rejects bookings beyond expiry', () => {
    const amenities = new AmenitiesService(community);
    const amenity = amenities.create(admin, {
      name: 'Hall',
      description: '',
      status: 'ACTIVE',
      timeZone: 'UTC',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      opensAt: '08:00',
      closesAt: '22:00',
      capacity: 5,
      exclusive: true,
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      maxActiveBookings: 3,
      advanceDays: 0,
      requiresApproval: false,
      feeMinor: 0,
      depositMinor: 0,
      bookingIntervalMinutes: 1,
      turnaroundMinutes: 0,
      allowExtensions: false,
      cancellationCutoffMinutes: 0,
    });
    const { lease } = proposal();
    rentals.acceptLease(tenant, lease.id);
    rentals.activateLease(admin, lease.id);
    const booking = amenities.book(tenant, amenity.id, {
      startsAt: '2027-01-20T10:00:00Z',
      endsAt: '2027-01-20T11:00:00Z',
      attendees: 1,
      expectedFeeMinor: 0,
      expectedDepositMinor: 0,
    });
    expect(booking.apartmentId).toBe(otherApartment);
    expect(() =>
      amenities.book(tenant, amenity.id, {
        startsAt: '2027-04-02T10:00:00Z',
        endsAt: '2027-04-02T11:00:00Z',
        attendees: 1,
        expectedFeeMinor: 0,
        expectedDepositMinor: 0,
      }),
    ).toThrow(ForbiddenException);
  });
  it('blocks rental handover when an unverified legacy occupant appears', () => {
    const { lease } = proposal();
    rentals.acceptLease(tenant, lease.id);
    users.create({
      id: 'legacy',
      name: 'Legacy resident',
      email: 'legacy@test.local',
      role: RoleName.Resident,
      apartmentId: otherApartment,
      passwordHash: 'test',
      createdAt: '',
    });
    expect(() => rentals.activateLease(admin, lease.id)).toThrow(
      /reconciliation/,
    );
    expect(rentals.myLease(tenant, lease.id).status).toBe('PENDING_APPROVAL');
    expect(rentals.myLease(tenant, lease.id).adminApprovedBy).toBeUndefined();
  });
  it('keeps partial DTO terms and zero-rent obligations without fabricated payments', () => {
    const listing = rentals.createListing(admin, {
      ...terms,
      apartmentId: otherApartment,
      arrangement: 'COMMUNITY',
      monthlyRent: 0,
    });
    rentals.updateListing(
      admin,
      listing.id,
      Object.assign(new UpdateListingDto(), { status: 'AVAILABLE' }),
    );
    const lease = rentals.createLease(admin, {
      listingId: listing.id,
      tenantId: tenant.id,
      startDate: '2027-01-01',
      endDate: '2027-03-31',
      dueDay: 31,
    });
    rentals.acceptLease(tenant, lease.id);
    rentals.activateLease(admin, lease.id);
    const mine = rentals.myLease(tenant, lease.id);
    expect(mine.obligations[0].status).toBe('NOT_REQUIRED');
    expect(mine.payments).toHaveLength(0);
  });
  it('preserves imported private records as read-only without generating new charges or enabling private workflows', () => {
    const { lease, listing } = proposal();
    rentals.acceptLease(tenant, lease.id);
    rentals.activateLease(admin, lease.id);
    const bill = rentals.myLease(tenant, lease.id).obligations[0];
    const payment = rentals.requestPayment(tenant, lease.id, bill.id, {
      amount: 100,
      transactionReference: 'legacy-reference',
    });
    rentals.verifyPayment(admin, payment.id);
    // Simulate pre-existing records loaded by the repository, never a supported private creation flow.
    const state = rentals as unknown as {
      leases: ReturnType<RentalsService['createLease']>[];
      listings: ReturnType<RentalsService['createListing']>[];
    };
    Object.assign(state.leases[0], {
      arrangement: 'OWNER',
      landlordId: owner.id,
    });
    Object.assign(state.listings[0], {
      arrangement: 'OWNER',
      landlordId: owner.id,
    });
    jest.setSystemTime(new Date('2027-02-15'));
    expect(rentals.availableListings(tenant)).toHaveLength(0);
    expect(rentals.myLease(tenant, lease.id)).toMatchObject({
      readOnly: true,
      payments: [
        expect.objectContaining({ id: payment.id, status: 'VERIFIED' }),
      ],
    });
    expect(rentals.myLease(tenant, lease.id).obligations).toHaveLength(1);
    expect(rentals.managedLeases(owner)[0].id).toBe(lease.id);
    expect(() =>
      rentals.updateListing(admin, listing.id, { monthlyRent: 1 }),
    ).toThrow(/read-only/);
    expect(() =>
      rentals.createLease(admin, {
        listingId: listing.id,
        tenantId: tenant.id,
        startDate: '2027-04-01',
        endDate: '2027-06-01',
        dueDay: 5,
      }),
    ).toThrow(/read-only/);
    expect(() =>
      rentals.onboardTenant(admin, {
        listingId: listing.id,
        existingTenantId: tenant.id,
        clientRequestId: 'legacy',
        startDate: '2027-04-01',
        endDate: '2027-06-01',
        dueDay: 5,
      }),
    ).toThrow(/read-only/);
    expect(() =>
      rentals.requestPayment(tenant, lease.id, bill.id, {
        amount: 10,
        transactionReference: 'new-private',
      }),
    ).toThrow(/read-only/);
    expect(() =>
      rentals.submitDepositEvidence(tenant, lease.id, {
        amount: 1,
        transactionReference: 'private-deposit',
      }),
    ).toThrow(/read-only/);
    expect(() =>
      rentals.requestLifecycle(tenant, lease.id, 'TERMINATION'),
    ).toThrow(/read-only/);
    expect(() =>
      rentals.reviewLease(admin, lease.id, 'APPROVED', 'legacy'),
    ).toThrow(/read-only/);
  });
});
