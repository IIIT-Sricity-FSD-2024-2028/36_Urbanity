import { ForbiddenException } from '@nestjs/common';
import { RoleName } from '../../common/enums/roles.enum';
import { RentalsService } from './rentals.service';

const communityId = '10000000-0000-4000-8000-000000000001';
const otherCommunityId = '10000000-0000-4000-8000-000000000002';
const apartmentId = '40000000-0000-4000-8000-000000000001';
const ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const tenantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
const outsiderId = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const towerId = '20000000-0000-4000-8000-000000000001';
const floorId = '30000000-0000-4000-8000-000000000001';
const otherTowerId = '20000000-0000-4000-8000-000000000011';

describe('RentalsService', () => {
  let service: RentalsService;
  const users = new Map<string, any>([
    [ownerId, { id: ownerId, role: RoleName.Resident, apartmentId }],
    [
      tenantId,
      {
        id: tenantId,
        role: RoleName.Resident,
        apartmentId: '40000000-0000-4000-8000-000000000002',
      },
    ],
    [
      outsiderId,
      {
        id: outsiderId,
        role: RoleName.Resident,
        apartmentId: '40000000-0000-4000-8000-000000000003',
      },
    ],
    [adminId, { id: adminId, role: RoleName.CommunityAdmin, communityId }],
  ]);
  const community: any = {
    getApartment: jest.fn((id) => ({
      id,
      floorId: id.endsWith('003') ? `${floorId}-b` : floorId,
      ownerUserId: undefined,
    })),
    getFloor: jest.fn((id) => ({
      id,
      towerId: id.endsWith('-b') ? otherTowerId : towerId,
    })),
    getTower: jest.fn((id) => ({
      id,
      communityId: id === otherTowerId ? otherCommunityId : communityId,
    })),
  };
  const userService: any = { findById: (id: string) => users.get(id) };
  const owner = {
    id: ownerId,
    role: RoleName.Resident,
    email: 'owner@test.local',
  } as any;
  const tenant = {
    id: tenantId,
    role: RoleName.Resident,
    email: 'tenant@test.local',
  } as any;
  const admin = {
    id: adminId,
    role: RoleName.CommunityAdmin,
    email: 'admin@test.local',
  } as any;
  const otherAdmin = {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    role: RoleName.CommunityAdmin,
    email: 'admin-b@test.local',
  } as any;
  users.set(otherAdmin.id, { ...otherAdmin, communityId: otherCommunityId });
  const listingDto = {
    apartmentId,
    arrangement: 'COMMUNITY' as const,
    monthlyRent: 15000,
    securityDeposit: 30000,
    availableFrom: '2026-01-01',
    availableUntil: '2035-12-31',
  };
  const createActiveLease = () => {
    const listing = service.createListing(admin, listingDto);
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      dueDay: 5,
    });
    service.acceptLease(tenant, lease.id);
    service.reviewLease(admin, lease.id, 'APPROVED', 'Approved lease');
    service.activateLease(admin, lease.id);
    return { listing, lease };
  };

  beforeEach(() => {
    community.getApartment.mockImplementation((id: string) => ({
      id,
      floorId: id.endsWith('003') ? `${floorId}-b` : floorId,
      ownerUserId: undefined,
    }));
    service = new RentalsService(community, userService);
  });

  it('disables private listing creation for owners and admins', () => {
    expect(() =>
      service.createListing(owner, { ...listingDto, arrangement: 'OWNER' }),
    ).toThrow(/Private rentals/);
    expect(() =>
      service.createListing(admin, { ...listingDto, arrangement: 'OWNER' }),
    ).toThrow(/Private rentals/);
  });
  it('prevents residents from creating or editing community rental listings', () => {
    const listing = service.createListing(admin, listingDto);
    expect(() => service.createListing(tenant, listingDto)).toThrow(
      ForbiddenException,
    );
    expect(() =>
      service.updateListing(tenant, listing.id, { monthlyRent: 1 }),
    ).toThrow(ForbiddenException);
  });

  it('scopes community listings to a Community Admin and records community as the recipient', () => {
    const listing = service.createListing(admin, {
      ...listingDto,
      apartmentId: '40000000-0000-4000-8000-000000000002',
      arrangement: 'COMMUNITY',
    });
    expect(listing.landlordId).toBe(communityId);
    expect(() =>
      service.createListing(owner, { ...listingDto, arrangement: 'COMMUNITY' }),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.createListing(otherAdmin, {
        ...listingDto,
        arrangement: 'COMMUNITY',
      }),
    ).toThrow(ForbiddenException);
  });

  it('creates a lease for a same-community resident and prevents a second published listing for the same apartment', () => {
    const listing = service.createListing(admin, listingDto);
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      dueDay: 5,
    });
    expect(() => service.createListing(admin, listingDto)).toThrow(
      /open rental listing/,
    );
    expect(() => service.activateLease(admin, lease.id)).toThrow(/acceptance/);
  });

  it('isolates tenant lease details and generates one obligation per billing month', () => {
    const { lease } = createActiveLease();
    expect(() =>
      service.myLease({ ...tenant, id: outsiderId }, lease.id),
    ).toThrow();
    const first = service.myLease(tenant, lease.id);
    const again = service.myLease(tenant, lease.id);
    expect(first.obligations.length).toBeGreaterThan(0);
    expect(again.obligations).toHaveLength(first.obligations.length);
    expect(first.deposit.agreed).toBe(30000);
    expect(first.deposit.collected).toBe(0);
    expect(first.currentMonthlyRent).toBe(15000);
  });

  it('uses inclusive UTC date-only lease boundaries, full-month billing, and clamps due days at month end', () => {
    const listing = service.createListing(admin, listingDto);
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: '2026-02-15',
      endDate: '2026-10-31',
      dueDay: 31,
    });
    service.acceptLease(tenant, lease.id);
    service.reviewLease(admin, lease.id, 'APPROVED', 'Approved lease');
    service.activateLease(admin, lease.id);
    const february = service
      .myLease(tenant, lease.id)
      .obligations.find((item: any) => item.billingPeriod === '2026-02')!;
    expect(february.amountDue).toBe(15000); // Partial periods are billed as full months until proration is modeled.
    expect(february.dueDate).toBe('2026-02-28T23:59:59.999Z');
    expect(
      service
        .myLease(tenant, lease.id)
        .obligations.filter((item: any) => item.billingPeriod === '2026-10'),
    ).toHaveLength(1);
    expect(() =>
      service.createLease(admin, {
        listingId: listing.id,
        tenantId,
        startDate: '2026-10-31',
        endDate: '2027-01-01',
        dueDay: 5,
      }),
    ).toThrow(/not available/);
  });

  it('rejects malformed or excessive direct service money values and case-insensitive duplicate references', () => {
    expect(() =>
      service.createListing(admin, { ...listingDto, monthlyRent: Number.NaN }),
    ).toThrow(/valid INR amount/);
    expect(() =>
      service.createListing(admin, {
        ...listingDto,
        securityDeposit: 100000001,
      }),
    ).toThrow(/valid INR amount/);
    const { lease } = createActiveLease();
    const obligation = service.myLease(tenant, lease.id).obligations[0];
    expect(() =>
      service.requestPayment(tenant, lease.id, obligation.id, {
        amount: Number.POSITIVE_INFINITY,
        transactionReference: 'invalid',
      }),
    ).toThrow(/valid INR amount/);
    service.requestPayment(tenant, lease.id, obligation.id, {
      amount: 100,
      transactionReference: 'Ref-Case',
    });
    expect(() =>
      service.requestPayment(tenant, lease.id, obligation.id, {
        amount: 100,
        transactionReference: 'ref-case',
      }),
    ).toThrow(/already been recorded/);
  });

  it('does not allow a manager to edit rent or deposit after a listing is reserved', () => {
    const { listing } = createActiveLease();
    expect(() =>
      service.updateListing(admin, listing.id, { monthlyRent: 16000 }),
    ).toThrow(/cannot be changed/);
    expect(() =>
      service.updateListing(admin, listing.id, { securityDeposit: 0 }),
    ).toThrow(/cannot be changed/);
  });

  it('applies only an accepted percentage escalation on its effective billing period and preserves old obligations', () => {
    const listing = service.createListing(admin, listingDto);
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: '2026-01-01',
      endDate: '2029-01-01',
      dueDay: 5,
      escalation: {
        method: 'PERCENTAGE',
        value: 5,
        intervalMonths: 12,
        effectiveDate: '2027-07-01',
        maxIncreases: 2,
      },
    });
    service.acceptLease(tenant, lease.id);
    service.reviewLease(admin, lease.id, 'APPROVED', 'Approved lease');
    service.activateLease(admin, lease.id);
    jest.useFakeTimers().setSystemTime(new Date('2027-08-10T12:00:00.000Z'));
    try {
      const result = service.myLease(tenant, lease.id);
      expect(
        result.obligations.find(
          (item: any) => item.billingPeriod === '2026-06',
        )!.amountDue,
      ).toBe(15000);
      expect(
        result.obligations.find(
          (item: any) => item.billingPeriod === '2027-07',
        )!.amountDue,
      ).toBe(15750);
      expect(result.currentMonthlyRent).toBe(15750);
      expect(result.nextRentIncrease).toEqual({
        date: '2028-07-01',
        amount: 16537.5,
      });
      expect(
        service
          .myLease(tenant, lease.id)
          .obligations.find((item: any) => item.billingPeriod === '2026-06')!
          .amountDue,
      ).toBe(15000);
    } finally {
      jest.useRealTimers();
    }
  });

  it('supports a fixed rent increase, leaves rent unchanged without an accepted clause, and rejects invalid escalation terms', () => {
    const listing = service.createListing(admin, listingDto);
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    expect(() =>
      service.createLease(admin, {
        listingId: listing.id,
        tenantId,
        startDate: '2026-01-01',
        endDate: '2028-01-01',
        dueDay: 1,
        escalation: {
          method: 'PERCENTAGE',
          value: -1,
          intervalMonths: 12,
          effectiveDate: '2027-01-01',
        },
      }),
    ).toThrow();
    expect(() =>
      service.createLease(admin, {
        listingId: listing.id,
        tenantId,
        startDate: '2026-01-01',
        endDate: '2028-01-01',
        dueDay: 1,
        escalation: {
          method: 'FIXED',
          value: 100,
          intervalMonths: 12,
          effectiveDate: '2026-12-15',
        },
      }),
    ).toThrow(/first day/);
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: '2026-01-01',
      endDate: '2028-01-01',
      dueDay: 1,
      escalation: {
        method: 'FIXED',
        value: 500,
        intervalMonths: 12,
        effectiveDate: '2027-01-01',
        maxIncreases: 1,
      },
    });
    service.acceptLease(tenant, lease.id);
    service.reviewLease(admin, lease.id, 'APPROVED', 'Approved lease');
    service.activateLease(admin, lease.id);
    jest.useFakeTimers().setSystemTime(new Date('2027-02-02T12:00:00.000Z'));
    try {
      const result = service.myLease(tenant, lease.id);
      expect(
        result.obligations.find(
          (item: any) => item.billingPeriod === '2026-12',
        )!.amountDue,
      ).toBe(15000);
      expect(
        result.obligations.find(
          (item: any) => item.billingPeriod === '2027-01',
        )!.amountDue,
      ).toBe(15500);
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes upcoming expiry and due information and expires a lease proposal past its end boundary', () => {
    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - 2);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
    const listing = service.createListing(admin, {
      ...listingDto,
      availableFrom: dateOnly(start),
    });
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: dateOnly(start),
      endDate: dateOnly(end),
      dueDay: 28,
    });
    service.acceptLease(tenant, lease.id);
    service.reviewLease(admin, lease.id, 'APPROVED', 'Approved lease');
    service.activateLease(admin, lease.id);
    const result = service.myLease(tenant, lease.id);
    expect(result.reminders.leaseExpiry).toBe(dateOnly(end));
    expect(result.reminders.delivery).toBe('IN_APP_ONLY');
    expect(
      result.obligations.every((item: any) => item.outstandingBalance >= 0),
    ).toBe(true);
    const expiredListing = service.createListing(admin, {
      ...listingDto,
      apartmentId: '40000000-0000-4000-8000-000000000002',
      arrangement: 'COMMUNITY',
      availableFrom: '1999-01-01',
    });
    service.updateListing(admin, expiredListing.id, { status: 'AVAILABLE' });
    const expired = service.createLease(admin, {
      listingId: expiredListing.id,
      tenantId,
      startDate: '1999-01-01',
      endDate: '2000-01-01',
      dueDay: 5,
    });
    service.acceptLease(tenant, expired.id);
    expect(() => service.activateLease(admin, expired.id)).toThrow(/expired/);
  });

  it('records payment evidence as pending and applies it only after recipient verification', () => {
    const { lease } = createActiveLease();
    const obligation = service.myLease(tenant, lease.id).obligations[0];
    const evidence = service.requestPayment(tenant, lease.id, obligation.id, {
      amount: 500,
      transactionReference: 'txn-500',
    });
    expect(evidence.status).toBe('PENDING_VERIFICATION');
    expect(() =>
      service.requestPayment(tenant, lease.id, obligation.id, {
        amount: 500,
        transactionReference: 'txn-500',
      }),
    ).toThrow(/already been recorded/);
    expect(service.verifyPayment(admin, evidence.id).status).toBe('VERIFIED');
    expect(
      service
        .myLease(tenant, lease.id)
        .obligations.find((item: any) => item.id === obligation.id)!.amountPaid,
    ).toBe(500);
    expect(() => service.verifyPayment(admin, evidence.id)).toThrow(
      /already been processed/,
    );
  });

  it('keeps rejected rent evidence out of balances and preserves verified payments when issuing a refund', () => {
    const { lease } = createActiveLease();
    const obligation = service.myLease(tenant, lease.id).obligations[0];
    const rejected = service.requestPayment(tenant, lease.id, obligation.id, {
      amount: 300,
      transactionReference: 'rent-rejected',
    });
    service.reviewPayment(admin, rejected.id, 'REJECTED');
    expect(
      service
        .myLease(tenant, lease.id)
        .obligations.find((item: any) => item.id === obligation.id)!.amountPaid,
    ).toBe(0);
    const payment = service.requestPayment(tenant, lease.id, obligation.id, {
      amount: 1000,
      transactionReference: 'rent-paid',
    });
    service.verifyPayment(admin, payment.id);
    const refund = service.recordPaymentRefund(admin, payment.id, {
      amount: 250,
      reason: 'Overpayment adjustment',
      transactionReference: 'rent-refund-1',
    });
    expect(() =>
      service.reviewPaymentRefund(
        { ...tenant, id: outsiderId },
        refund.id,
        'VERIFIED',
      ),
    ).toThrow(ForbiddenException);
    expect(
      service
        .myLease(tenant, lease.id)
        .obligations.find((item: any) => item.id === obligation.id)!.amountPaid,
    ).toBe(1000);
    service.reviewPaymentRefund(tenant, refund.id, 'VERIFIED');
    expect(
      service
        .myLease(tenant, lease.id)
        .obligations.find((item: any) => item.id === obligation.id)!.amountPaid,
    ).toBe(750);
    expect(
      service
        .myLease(tenant, lease.id)
        .payments.find((item: any) => item.id === payment.id)!.status,
    ).toBe('VERIFIED');
  });

  it('preserves the original lease and financial history through approved renewal and termination requests', () => {
    const { lease } = createActiveLease();
    const renewal = service.requestLifecycle(tenant, lease.id, 'RENEWAL');
    service.decideLifecycle(admin, renewal.id, 'APPROVED');
    expect(service.managedLeases(admin)).toHaveLength(2);
    const termination = service.requestLifecycle(
      tenant,
      lease.id,
      'TERMINATION',
    );
    service.decideLifecycle(admin, termination.id, 'APPROVED');
    expect(service.myLease(tenant, lease.id).status).toBe('TERMINATED');
  });

  it('tracks verified deposit collection, deductions, refunds, and preserves the transaction history', () => {
    const { lease } = createActiveLease();
    expect(() =>
      service.submitDepositEvidence(tenant, lease.id, {
        amount: 30001,
        transactionReference: 'deposit-too-large',
      }),
    ).toThrow(/agreed deposit/);
    const collection = service.submitDepositEvidence(tenant, lease.id, {
      amount: 1000,
      transactionReference: 'deposit-collection-1',
    });
    expect(collection.status).toBe('PENDING_VERIFICATION');
    expect(() =>
      service.reviewDeposit(
        { ...tenant, id: outsiderId },
        collection.id,
        'VERIFIED',
      ),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.recordDepositAdjustment(admin, lease.id, 'DEDUCTION', {
        amount: 1,
        reason: 'not settled',
      }),
    ).toThrow(/expired or terminated/);
    expect(service.reviewDeposit(admin, collection.id, 'VERIFIED').status).toBe(
      'VERIFIED',
    );
    service.requestLifecycle(tenant, lease.id, 'TERMINATION');
    const request = service.myLease(tenant, lease.id).requests[0];
    service.decideLifecycle(admin, request.id, 'APPROVED');
    const deduction = service.recordDepositAdjustment(
      admin,
      lease.id,
      'DEDUCTION',
      { amount: 200, reason: 'Documented repair' },
    );
    expect(deduction.status).toBe('PENDING_TENANT_CONFIRMATION');
    expect(service.myLease(tenant, lease.id).deposit.deductions).toBe(0);
    service.decideDepositDeduction(tenant, deduction.id, {
      decision: 'ACCEPTED',
    });
    const refund = service.recordDepositAdjustment(admin, lease.id, 'REFUND', {
      amount: 800,
      reason: 'Balance returned',
      transactionReference: 'deposit-refund-1',
    });
    expect(service.reviewDeposit(tenant, refund.id, 'VERIFIED').status).toBe(
      'VERIFIED',
    );
    const deposit = service.myLease(tenant, lease.id).deposit;
    expect(deposit.collected).toBe(1000);
    expect(deposit.deductions).toBe(200);
    expect(deposit.refunded).toBe(800);
    expect(deposit.history).toHaveLength(3);
    expect(() =>
      service.recordDepositAdjustment(admin, lease.id, 'REFUND', {
        amount: 1,
        reason: 'Over refund',
        transactionReference: 'deposit-refund-2',
      }),
    ).toThrow(/balance/);
  });

  it('keeps pending rent amendments out of rent and applies accepted future terms without rewriting old obligations', () => {
    const { lease } = createActiveLease();
    const before = service
      .myLease(tenant, lease.id)
      .obligations.map((item: any) => ({
        id: item.id,
        amountDue: item.amountDue,
      }));
    const amendment = service.proposeAmendment(admin, lease.id, {
      monthlyRent: 18000,
      effectiveDate: '2027-01-01',
      reason: 'Agreed annual adjustment',
    });
    expect(service.myLease(tenant, lease.id).currentMonthlyRent).toBe(15000);
    expect(() =>
      service.decideAmendment(
        { ...tenant, id: outsiderId },
        amendment.id,
        'ACCEPTED',
      ),
    ).toThrow(ForbiddenException);
    service.decideAmendment(tenant, amendment.id, 'ACCEPTED');
    expect(service.myLease(tenant, lease.id).currentMonthlyRent).toBe(15000);
    expect(
      service.myLease(tenant, lease.id).obligations.map((item: any) => ({
        id: item.id,
        amountDue: item.amountDue,
      })),
    ).toEqual(before);
    jest.useFakeTimers().setSystemTime(new Date('2027-02-10T12:00:00.000Z'));
    try {
      const current = service.myLease(tenant, lease.id);
      expect(current.currentMonthlyRent).toBe(18000);
      expect(
        current.amendments.find((item: any) => item.id === amendment.id)!
          .status,
      ).toBe('APPLIED');
      expect(
        current.obligations.find(
          (item: any) => item.billingPeriod === '2027-01',
        )!.amountDue,
      ).toBe(18000);
      expect(
        current.obligations.find(
          (item: any) => item.billingPeriod === '2026-09',
        )!.amountDue,
      ).toBe(15000);
    } finally {
      jest.useRealTimers();
    }
    expect(() =>
      service.decideAmendment(tenant, amendment.id, 'ACCEPTED'),
    ).toThrow(/already been decided/);
    expect(() =>
      service.proposeAmendment(outsiderId as any, lease.id, {
        monthlyRent: 1,
        effectiveDate: '2027-03-01',
        reason: 'Unauthorized',
      }),
    ).toThrow(ForbiddenException);
  });

  it('records tenant rejection without changing the agreed rent and rejects renewal terms that overlap the prior lease', () => {
    const { lease } = createActiveLease();
    const amendment = service.proposeAmendment(admin, lease.id, {
      monthlyRent: 22000,
      effectiveDate: '2027-01-01',
      reason: 'Proposed increase',
    });
    service.decideAmendment(tenant, amendment.id, 'REJECTED');
    expect(service.myLease(tenant, lease.id).currentMonthlyRent).toBe(15000);
    expect(service.myLease(tenant, lease.id).amendments[0].status).toBe(
      'REJECTED',
    );
    expect(() =>
      service.requestLifecycle(tenant, lease.id, 'RENEWAL', {
        startDate: '2027-01-01',
        endDate: '2028-01-01',
        monthlyRent: 15000,
        securityDeposit: 30000,
        dueDay: 5,
      }),
    ).toThrow(/begin after the existing inclusive lease end/);
  });

  it('creates a distinct renewal with new terms and no inherited escalation while retaining the old lease history', () => {
    const listing = service.createListing(admin, listingDto);
    service.updateListing(admin, listing.id, { status: 'AVAILABLE' });
    const lease = service.createLease(admin, {
      listingId: listing.id,
      tenantId,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      dueDay: 5,
      escalation: {
        method: 'FIXED',
        value: 500,
        intervalMonths: 12,
        effectiveDate: '2026-07-01',
        maxIncreases: 2,
      },
    });
    service.acceptLease(tenant, lease.id);
    service.reviewLease(admin, lease.id, 'APPROVED', 'Approved lease');
    service.activateLease(admin, lease.id);
    const old = service.myLease(tenant, lease.id);
    const oldObligations = old.obligations.map((item: any) => item.id);
    const request = service.requestLifecycle(tenant, lease.id, 'RENEWAL', {
      startDate: '2027-01-02',
      endDate: '2028-01-01',
      monthlyRent: 19000,
      securityDeposit: 25000,
      dueDay: 10,
    });
    expect(() => service.requestLifecycle(tenant, lease.id, 'RENEWAL')).toThrow(
      /already pending/,
    );
    const approved = service.decideLifecycle(admin, request.id, 'APPROVED');
    expect(approved.successorLeaseId).toBeDefined();
    const successor = service.myLease(tenant, approved.successorLeaseId!);
    expect(successor.monthlyRent).toBe(19000);
    expect(successor.escalation).toBeUndefined();
    expect(successor.predecessorLeaseId).toBe(lease.id);
    expect(
      service.myLease(tenant, lease.id).obligations.map((item: any) => item.id),
    ).toEqual(oldObligations);
    expect(() =>
      service.decideLifecycle(admin, request.id, 'APPROVED'),
    ).toThrow(/already been processed/);
    expect(() =>
      service.requestLifecycle(tenant, lease.id, 'RENEWAL', {
        startDate: '2028-01-02',
        endDate: '2029-01-01',
        monthlyRent: 19000,
        securityDeposit: 25000,
        dueDay: 10,
      }),
    ).toThrow(/already been approved/);
  });

  it('keeps disputed deductions unfinalized, reserves their amount, and resolves them once', () => {
    const { lease } = createActiveLease();
    service.submitDepositEvidence(tenant, lease.id, {
      amount: 1000,
      transactionReference: 'deposit-dispute-collect',
    });
    const collection = service.myLease(tenant, lease.id).deposit.history[0];
    service.reviewDeposit(admin, collection.id, 'VERIFIED');
    service.requestLifecycle(tenant, lease.id, 'TERMINATION');
    service.decideLifecycle(
      admin,
      service.myLease(tenant, lease.id).requests[0].id,
      'APPROVED',
    );
    const deduction = service.recordDepositAdjustment(
      admin,
      lease.id,
      'DEDUCTION',
      { amount: 700, reason: 'Repair' },
    );
    expect(() =>
      service.recordDepositAdjustment(admin, lease.id, 'DEDUCTION', {
        amount: 400,
        reason: 'Extra repair',
      }),
    ).toThrow(/balance/);
    expect(() =>
      service.decideDepositDeduction(
        { ...tenant, id: outsiderId },
        deduction.id,
        { decision: 'DISPUTED', reason: 'Not my damage' },
      ),
    ).toThrow(ForbiddenException);
    service.decideDepositDeduction(tenant, deduction.id, {
      decision: 'DISPUTED',
      reason: 'Pre-existing condition',
    });
    const disputed = service
      .myLease(tenant, lease.id)
      .deposit.history.find((item: any) => item.id === deduction.id)!;
    expect(disputed.decisionBy).toBe(tenantId);
    expect(disputed.decisionAt).toBeDefined();
    expect(service.myLease(tenant, lease.id).deposit.deductions).toBe(0);
    expect(service.myLease(tenant, lease.id).deposit.pendingDeductions).toBe(
      700,
    );
    service.resolveDepositDispute(admin, deduction.id, {
      decision: 'REJECTED',
      reason: 'Inspection did not support charge',
    });
    const resolved = service
      .myLease(tenant, lease.id)
      .deposit.history.find((item: any) => item.id === deduction.id)!;
    expect(service.myLease(tenant, lease.id).deposit.deductions).toBe(0);
    expect(resolved).toMatchObject({
      decisionBy: tenantId,
      resolvedBy: adminId,
      resolutionReason: 'Inspection did not support charge',
    });
    expect(() =>
      service.resolveDepositDispute(admin, deduction.id, {
        decision: 'VERIFIED',
        reason: 'second decision',
      }),
    ).toThrow(/Only a disputed/);
  });
});
