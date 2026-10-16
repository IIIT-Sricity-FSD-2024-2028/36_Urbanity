import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AmenitiesService } from './amenities.service';
import { AmenityDto } from './amenities.dto';
import type { CommunityService } from '../community/community.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { RoleName } from '../../common/enums/roles.enum';
import { dayInstants, instant, localParts } from './amenities.time';

const actor = (id: string, role = RoleName.Resident): AuthenticatedUser => ({
  id,
  email: `${id}@test.local`,
  role,
});
const admin = actor('admin', RoleName.CommunityAdmin),
  resident = actor('resident'),
  other = actor('other'),
  outsider = actor('outside');
const time = (clock: string, date = '2027-01-02') => `${date}T${clock}:00.000Z`;
const window = (start = '10:00', end = '11:00') => ({
  startsAt: time(start),
  endsAt: time(end),
  attendees: 2,
});
const price = { expectedFeeMinor: 5000, expectedDepositMinor: 10000 };
const config = (overrides = {}): AmenityDto =>
  Object.assign(
    new AmenityDto(),
    {
      name: 'Hall',
      description: '',
      status: 'ACTIVE',
      timeZone: 'UTC',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      opensAt: '08:00',
      closesAt: '23:59',
      capacity: 10,
      exclusive: true,
      minDurationMinutes: 30,
      maxDurationMinutes: 180,
      maxActiveBookings: 10,
      advanceDays: 0,
      requiresApproval: false,
      allowExtensions: true,
      bookingIntervalMinutes: 15,
      feeMinor: 5000,
      depositMinor: 10000,
    },
    overrides,
  );

describe('F05 availability, changes and extension invariants', () => {
  let service: AmenitiesService;
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2027-01-01T00:00:00Z'));
    service = new AmenitiesService({
      listCommunitiesForActor: (a: AuthenticatedUser) => [
        { id: a.id === 'adminB' ? 'B' : 'A' },
      ],
      resolveResidentHierarchy: (id: string) => ({
        community: { id: id === 'outside' ? 'B' : 'A' },
        apartment: { id: `apt-${id}` },
      }),
    } as unknown as CommunityService);
  });
  afterEach(() => jest.restoreAllMocks());
  const create = (overrides = {}) => service.create(admin, config(overrides));
  const book = (id: string, values = window(), who = resident) =>
    service.book(who, id, {
      ...values,
      ...price,
      clientRequestId: randomUUID(),
    });
  const change = (
    b: ReturnType<typeof book>,
    values = window('10:00', '12:00'),
    kind: 'EXTEND' | 'EDIT' = 'EXTEND',
  ) => ({
    ...values,
    kind,
    expectedVersion: b.version,
    clientRequestId: randomUUID(),
  });

  it('allows the clubhouse sequence, exact adjacency and only actual intervals', () => {
    const a = create({ opensAt: '17:30', maxDurationMinutes: 120 });
    book(a.id, window('18:00', '19:00'));
    book(a.id, window('19:00', '21:00'), other);
    book(a.id, window('21:00', '22:30'));
    expect(service.listBookings(admin)).toHaveLength(3);
    expect(() => book(a.id, window('18:30', '19:30'))).toThrow(
      ConflictException,
    );
  });
  it.each([
    ['10:00', '10:15'],
    ['10:00', '13:15'],
    ['11:00', '10:00'],
    ['07:00', '08:00'],
    ['23:00', '23:59'],
    ['10:01', '11:01'],
  ])(
    'rejects duration, ordering, operating-hour and increment errors: %s to %s',
    (start, end) => {
      const a = create();
      expect(() => book(a.id, window(start, end))).toThrow(BadRequestException);
    },
  );
  it('rejects impossible dates, partial minutes and overnight windows at service level', () => {
    const a = create();
    for (const startsAt of [
      '2027-02-30T10:00:00Z',
      '2027-01-02T24:00:00Z',
      '2027-01-02T10:00:01Z',
      '2027-01-02T10:00',
    ])
      expect(() => book(a.id, { ...window(), startsAt })).toThrow(
        BadRequestException,
      );
    expect(() =>
      book(a.id, {
        ...window('23:00', '23:30'),
        endsAt: time('00:30', '2027-01-03'),
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.dayAvailability(resident, a.id, {
        date: '2027-02-30',
        attendees: 1,
      }),
    ).toThrow(BadRequestException);
  });
  it('preserves legacy defaults and rejects increments with no valid duration', () => {
    const a = create({
      bookingIntervalMinutes: undefined,
      turnaroundMinutes: undefined,
      allowExtensions: undefined,
    });
    expect(a).toMatchObject({
      bookingIntervalMinutes: 1,
      turnaroundMinutes: 0,
      allowExtensions: false,
    });
    expect(() =>
      create({
        minDurationMinutes: 31,
        maxDurationMinutes: 40,
        bookingIntervalMinutes: 30,
      }),
    ).toThrow(BadRequestException);
  });
  it('enforces turnaround in both directions, including maintenance blocks', () => {
    const a = create({ turnaroundMinutes: 15 });
    book(a.id);
    expect(() => book(a.id, window('11:00', '12:00'), other)).toThrow(
      ConflictException,
    );
    expect(() => book(a.id, window('09:00', '10:00'), other)).toThrow(
      ConflictException,
    );
    expect(book(a.id, window('11:15', '12:15'), other)).toBeDefined();
    service.block(admin, a.id, {
      ...window('14:00', '15:00'),
      reason: 'Cleaning',
    });
    expect(() => book(a.id, window('13:00', '14:00'))).toThrow(
      ConflictException,
    );
    expect(() =>
      service.block(admin, a.id, {
        ...window('12:15', '13:15'),
        reason: 'Repair',
      }),
    ).toThrow(ConflictException);
  });
  it('calculates anonymous start/end choices from holds, rules and closures', () => {
    const a = create();
    book(a.id);
    const day = service.dayAvailability(resident, a.id, {
      date: '2027-01-02',
      attendees: 2,
      startsAt: time('11:00'),
    });
    expect(day.starts.some((s) => s.value === time('11:00'))).toBe(true);
    expect(day.starts.some((s) => s.value === time('10:00'))).toBe(false);
    expect(day.ends.some((e) => e.value === time('11:30'))).toBe(true);
    expect(day.ends.some((e) => e.value === time('14:15'))).toBe(false);
    expect(JSON.stringify(day)).not.toContain('residentId');
    expect(JSON.stringify(day)).not.toContain('apartmentId');
    expect(() =>
      service.dayAvailability(outsider, a.id, {
        date: '2027-01-02',
        attendees: 1,
      }),
    ).toThrow(ForbiddenException);
  });
  it('counts shared occupancy and pending changes once, not twice', () => {
    const a = create({ exclusive: false, capacity: 5, requiresApproval: true });
    const b = book(a.id);
    service.transition(admin, b.id, 'APPROVED', 'Review');
    service.change(resident, b.id, change(b));
    book(a.id, window('10:00', '12:00'), other);
    expect(() => book(a.id, { ...window(), attendees: 2 }, other)).toThrow(
      ConflictException,
    );
  });
  it('extends with one separate pending fee and unchanged deposit, and retries idempotently', () => {
    const a = create(),
      b = book(a.id),
      dto = change(b),
      payments = b.paymentHistory.length;
    const result = service.change(resident, b.id, dto)!;
    expect(result.endsAt).toBe(time('12:00'));
    expect(result.feeMinor).toBe(5000);
    expect(result.depositMinor).toBe(10000);
    expect(result.paymentHistory).toHaveLength(payments + 1);
    expect(result.extensionCharges).toHaveLength(1);
    expect(result.extensionCharges[0]).toMatchObject({
      amountMinor: 5000,
      paymentStatus: 'PENDING',
    });
    service.change(resident, b.id, dto);
    expect(result.changes).toHaveLength(1);
    expect(service.listBookings(admin)).toHaveLength(1);
    expect(() =>
      service.change(resident, b.id, { ...dto, endsAt: time('12:30') }),
    ).toThrow(ConflictException);
  });
  it.each([
    'overlap',
    'maximum',
    'hours',
    'maintenance',
    'disabled',
    'wrong-owner',
    'cancelled',
    'expired',
  ])('rejects %s extensions and preserves the original interval', (mode) => {
    const a = create({ allowExtensions: mode !== 'disabled' }),
      b = book(a.id),
      original = b.endsAt;
    let dto = change(b);
    if (mode === 'overlap') book(a.id, window('11:00', '12:00'), other);
    if (mode === 'maximum') dto = { ...dto, endsAt: time('13:15') };
    if (mode === 'hours') dto = { ...dto, endsAt: time('00:00', '2027-01-03') };
    if (mode === 'maintenance')
      service.block(admin, a.id, {
        ...window('11:00', '12:00'),
        reason: 'Repair',
      });
    if (mode === 'cancelled')
      service.transition(resident, b.id, 'CANCELLED', 'No longer needed');
    if (mode === 'expired')
      jest.spyOn(Date, 'now').mockReturnValue(Date.parse(original));
    expect(() =>
      service.change(mode === 'wrong-owner' ? other : resident, b.id, dto),
    ).toThrow();
    expect(b.endsAt).toBe(original);
    expect(b.changes).toHaveLength(0);
  });
  it('requires approval without changing the confirmed end; reserves the extra interval until rejection', () => {
    const a = create({ requiresApproval: true }),
      b = book(a.id);
    service.transition(admin, b.id, 'APPROVED', 'Review');
    const original = b.endsAt;
    service.change(resident, b.id, change(b));
    const c = b.changes[0];
    expect(b.endsAt).toBe(original);
    expect(c.status).toBe('PENDING_APPROVAL');
    expect(() => book(a.id, window('11:00', '12:00'), other)).toThrow(
      ConflictException,
    );
    expect(() => service.decideChange(other, b.id, c.id, true, 'Fake')).toThrow(
      ForbiddenException,
    );
    service.decideChange(admin, b.id, c.id, false, 'Declined');
    expect(b.endsAt).toBe(original);
    expect(book(a.id, window('11:00', '12:00'), other)).toBeDefined();
  });
  it('approves an extension once, revalidates it, and supports extending an ongoing booking', () => {
    const a = create({ requiresApproval: true }),
      b = book(a.id);
    service.transition(admin, b.id, 'APPROVED', 'Review');
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(time('10:30')));
    const options = service.changeAvailability(resident, b.id, {
      kind: 'EXTEND',
      date: '2027-01-02',
      attendees: 2,
    });
    expect(options.ends.some((e) => e.value === time('12:00'))).toBe(true);
    service.change(resident, b.id, change(b));
    const c = b.changes[0];
    service.decideChange(admin, b.id, c.id, true, 'Available');
    const version = b.version;
    service.decideChange(admin, b.id, c.id, true, 'Retry');
    expect(b.endsAt).toBe(time('12:00'));
    expect(b.version).toBe(version);
  });
  it('allows an edit excluding its own hold and preserves original and proposed slots pending approval', () => {
    const a = create({ requiresApproval: true }),
      b = book(a.id);
    service.transition(admin, b.id, 'APPROVED', 'Review');
    service.change(resident, b.id, change(b, window('14:00', '15:00'), 'EDIT'));
    expect(b.startsAt).toBe(time('10:00'));
    expect(() => book(a.id, window('10:00', '11:00'), other)).toThrow(
      ConflictException,
    );
    expect(() => book(a.id, window('14:00', '15:00'), other)).toThrow(
      ConflictException,
    );
    service.decideChange(admin, b.id, b.changes[0].id, true, 'Move approved');
    expect(b.startsAt).toBe(time('14:00'));
    book(a.id, window('10:00', '11:00'), other);
  });
  it('prevents stale edits, rule corruption, and cancellation-cutoff bypass by moving a booking', () => {
    const a = create({ cancellationCutoffMinutes: 60 }),
      b = book(a.id);
    expect(() =>
      service.change(resident, b.id, { ...change(b), expectedVersion: 999 }),
    ).toThrow(ConflictException);
    expect(() =>
      service.update(admin, a.id, config({ opensAt: '09:00' })),
    ).toThrow(ConflictException);
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(time('09:30')));
    expect(() =>
      service.transition(resident, b.id, 'CANCELLED', 'Too late'),
    ).toThrow(ConflictException);
    expect(() =>
      service.change(
        resident,
        b.id,
        change(b, window('14:00', '15:00'), 'EDIT'),
      ),
    ).toThrow(ConflictException);
  });
  it('retries creation without duplicating bookings and rejects reused request IDs', () => {
    const a = create(),
      dto = { ...window(), ...price, clientRequestId: randomUUID() };
    const b = service.book(resident, a.id, dto);
    expect(service.book(resident, a.id, dto).id).toBe(b.id);
    expect(service.listBookings(admin)).toHaveLength(1);
    expect(() =>
      service.book(resident, a.id, { ...dto, ...window('12:00', '13:00') }),
    ).toThrow(ConflictException);
  });
  it('handles DST gaps and repeated hours as distinct real instants', () => {
    const gap = dayInstants(
      '2027-03-14',
      'America/New_York',
      '00:00',
      '05:00',
      30,
    );
    expect(
      gap.some((t) =>
        localParts(t, 'America/New_York').label.startsWith('02:'),
      ),
    ).toBe(false);
    const repeated = dayInstants(
      '2027-11-07',
      'America/New_York',
      '00:00',
      '04:00',
      30,
    ).filter((t) =>
      localParts(t, 'America/New_York').label.startsWith('01:30'),
    );
    expect(repeated).toHaveLength(2);
    expect(repeated[1] - repeated[0]).toBe(3600000);
    expect(instant('2027-01-02T15:30:00+05:30')).toBe(
      Date.parse(time('10:00')),
    );
  });
  it('releases expired extension holds without approving or altering the original booking', () => {
    const a = create({ requiresApproval: true }),
      b = book(a.id);
    service.transition(admin, b.id, 'APPROVED', 'Review');
    service.change(resident, b.id, change(b));
    const id = b.changes[0].id;
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(time('11:00')));
    service.listBookings(resident);
    expect(b.changes[0].status).toBe('EXPIRED');
    expect(b.endsAt).toBe(time('11:00'));
    expect(() =>
      service.decideChange(admin, b.id, id, true, 'Too late'),
    ).toThrow(ConflictException);
    book(a.id, window('11:15', '12:15'), other);
  });
  it('checks extension opening hours separately from total duration and rejects pending originals', () => {
    const a = create({ closesAt: '22:30' }),
      b = book(a.id, window('21:00', '22:00'));
    expect(() =>
      service.change(resident, b.id, change(b, window('21:00', '23:00'))),
    ).toThrow('operating hours');
    const pendingAmenity = create({ requiresApproval: true }),
      pending = book(pendingAmenity.id);
    expect(() => service.change(resident, pending.id, change(pending))).toThrow(
      ConflictException,
    );
  });
  it('allows self-overlapping edits, future date moves, and keeps retry identity across terminal booking state', () => {
    const a = create(),
      b = book(a.id);
    service.change(resident, b.id, change(b, window('10:15', '11:15'), 'EDIT'));
    expect(b.startsAt).toBe(time('10:15'));
    const next = {
      ...window('10:00', '11:00'),
      startsAt: time('10:00', '2027-01-03'),
      endsAt: time('11:00', '2027-01-03'),
    };
    service.change(resident, b.id, change(b, next, 'EDIT'));
    expect(b.startsAt).toBe(next.startsAt);
    const dto = {
      ...window('14:00', '15:00'),
      ...price,
      clientRequestId: randomUUID(),
    };
    const duplicate = service.book(resident, a.id, dto);
    service.transition(resident, duplicate.id, 'CANCELLED', 'Cancel');
    expect(service.book(resident, a.id, dto).id).toBe(duplicate.id);
    expect(duplicate.status).toBe('CANCELLED');
  });
  it.each([
    ['13:00', 25000],
    ['12:30', 12500],
  ] as const)(
    'charges a 120-minute INR500 booking extended to %s exactly %i paise',
    (end, expected) => {
      const a = create({ feeMinor: 50000, maxDurationMinutes: 360 });
      const b = service.book(resident, a.id, {
        ...window('10:00', '12:00'),
        ...price,
        expectedFeeMinor: 50000,
      });
      expect(b.originalDurationMinutes).toBe(120);
      const options = service.changeAvailability(resident, b.id, {
        kind: 'EXTEND',
        date: '2027-01-02',
        attendees: 2,
      });
      expect(
        options.ends.find((e) => e.value === time(end))?.additionalFeeMinor,
      ).toBe(expected);
      service.change(resident, b.id, change(b, window('10:00', end)));
      expect(b.extensionCharges[0]).toMatchObject({
        amountMinor: expected,
        paymentStatus: 'PENDING',
      });
      expect(b.feeMinor).toBe(50000);
      expect(b.depositMinor).toBe(10000);
    },
  );
  it('uses the immutable original rate for multiple extensions despite facility price changes', () => {
    const a = create({ feeMinor: 50000, maxDurationMinutes: 360 });
    const b = service.book(resident, a.id, {
      ...window('10:00', '12:00'),
      ...price,
      expectedFeeMinor: 50000,
    });
    service.change(resident, b.id, change(b, window('10:00', '13:00')));
    service.update(
      admin,
      a.id,
      config({ feeMinor: 90000, maxDurationMinutes: 360 }),
    );
    service.change(resident, b.id, change(b, window('10:00', '13:30')));
    expect(b.extensionCharges.map((c) => c.amountMinor)).toEqual([
      25000, 12500,
    ]);
    expect(b.originalDurationMinutes).toBe(120);
    expect(b.feeMinor).toBe(50000);
    expect(b.depositMinor).toBe(10000);
    expect(b.extensionCharges.every((c) => c.paymentStatus === 'PENDING')).toBe(
      true,
    );
    expect(b.paymentHistory.filter((event) => event.chargeId)).toHaveLength(2);
  });
  it('records zero extension fees as not required and never charges a deposit again', () => {
    const a = create({ feeMinor: 0, depositMinor: 0 });
    const b = service.book(resident, a.id, {
      ...window(),
      expectedFeeMinor: 0,
      expectedDepositMinor: 0,
    });
    service.change(resident, b.id, change(b));
    expect(b.paymentStatus).toBe('NOT_REQUIRED');
    expect(b.extensionCharges[0]).toMatchObject({
      amountMinor: 0,
      paymentStatus: 'NOT_REQUIRED',
    });
    expect(b.depositMinor).toBe(0);
  });
  it('creates no payable charge for rejected, expired or cancelled pending extension requests', () => {
    for (const decision of ['reject', 'expire', 'cancel']) {
      jest
        .spyOn(Date, 'now')
        .mockReturnValue(Date.parse('2027-01-01T00:00:00Z'));
      const a = create({ requiresApproval: true }),
        b = book(a.id);
      service.transition(admin, b.id, 'APPROVED', 'Review');
      service.change(resident, b.id, change(b));
      const id = b.changes[0].id;
      expect(b.changes[0].extensionFeeMinor).toBe(5000);
      expect(b.extensionCharges).toHaveLength(0);
      if (decision === 'reject')
        service.decideChange(admin, b.id, id, false, 'Decline');
      if (decision === 'cancel')
        service.transition(resident, b.id, 'CANCELLED', 'Plans changed');
      if (decision === 'expire')
        jest.spyOn(Date, 'now').mockReturnValue(Date.parse(time('11:00')));
      expect(() =>
        service.decideChange(admin, b.id, id, true, 'Too late'),
      ).toThrow(ConflictException);
      expect(b.extensionCharges).toHaveLength(0);
      expect(b.paymentHistory.filter((e) => e.chargeId)).toHaveLength(0);
    }
  });
  it('voids pending extension charges with a cancelled reservation without recording a refund', () => {
    const a = create(),
      b = book(a.id);
    service.change(resident, b.id, change(b));
    service.transition(resident, b.id, 'CANCELLED', 'Plans changed');
    expect(b.extensionCharges[0].paymentStatus).toBe('VOIDED');
    expect(b.paymentStatus).toBe('VOIDED');
    expect(
      b.paymentHistory.filter((e) => e.chargeId).map((e) => e.status),
    ).toEqual(['PENDING', 'VOIDED']);
    expect(b.depositMinor).toBe(10000);
  });
  it('prevents using a free time edit to bypass extension charges or extension permissions', () => {
    const a = create({ allowExtensions: false }),
      b = book(a.id);
    expect(() =>
      service.change(
        resident,
        b.id,
        change(b, window('10:00', '12:00'), 'EDIT'),
      ),
    ).toThrow(BadRequestException);
    expect(b.extensionCharges).toHaveLength(0);
    expect(b.endsAt).toBe(time('11:00'));
  });

  it('requires X days before the start and permits bookings later than X days away', () => {
    const a = create({
      advanceDays: 7,
      timeZone: 'Asia/Kolkata',
      opensAt: '17:30',
      minDurationMinutes: 60,
      maxDurationMinutes: 389,
      bookingIntervalMinutes: 1,
    });
    const early = service.dayAvailability(resident, a.id, {
      date: '2027-01-02',
      attendees: 5,
    });
    expect(early.starts).toEqual([]);
    expect(early.unavailableReason?.code).toBe('MINIMUM_NOTICE');
    expect(early.bookingWindow).toEqual({
      minDate: '2027-01-08',
      earliestStartsAt: '2027-01-08T00:00:00.000Z',
    });
    const later = service.dayAvailability(resident, a.id, {
      date: '2027-01-31',
      attendees: 5,
    });
    expect(later.starts[0].label).toContain('17:30');
    expect(later.unavailableReason).toBeNull();
    expect(() => book(a.id, window())).toThrow(/at least 7 days before/);
  });
  it('enforces the exact minimum-notice boundary on the earliest eligible date', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2027-01-01T01:00:00Z'));
    const a = create({
      advanceDays: 7,
      opensAt: '00:00',
      closesAt: '03:00',
      bookingIntervalMinutes: 15,
    });
    const day = service.dayAvailability(resident, a.id, {
      date: '2027-01-08',
      attendees: 2,
      startsAt: '2027-01-08T01:00:00.000Z',
    });
    expect(
      day.starts.some((option) => option.value === '2027-01-08T01:00:00.000Z'),
    ).toBe(true);
    expect(
      day.starts.some((option) => option.value === '2027-01-08T00:45:00.000Z'),
    ).toBe(false);
    expect(day.selectedStartsAt).toBe('2027-01-08T01:00:00.000Z');
    expect(() =>
      book(a.id, {
        startsAt: '2027-01-08T00:45:00.000Z',
        endsAt: '2027-01-08T01:15:00.000Z',
        attendees: 2,
      }),
    ).toThrow(/at least 7 days before/);
    expect(
      book(a.id, {
        startsAt: '2027-01-08T01:00:00.000Z',
        endsAt: '2027-01-08T01:30:00.000Z',
        attendees: 2,
      }),
    ).toBeDefined();
  });
  it('does not restart the notice period when approving an already-held reservation', () => {
    const a = create({ advanceDays: 7, requiresApproval: true });
    const b = book(a.id, {
      startsAt: time('10:00', '2027-01-09'),
      endsAt: time('11:00', '2027-01-09'),
      attendees: 2,
    });
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2027-01-08T10:00:00Z'));
    expect(service.transition(admin, b.id, 'APPROVED', 'Reviewed').status).toBe(
      'APPROVED',
    );
    expect(() =>
      book(a.id, {
        startsAt: time('12:00', '2027-01-09'),
        endsAt: time('13:00', '2027-01-09'),
        attendees: 2,
      }),
    ).toThrow(/at least 7 days before/);
  });
  it('distinguishes closed days and the resident booking quota with zero-day notice', () => {
    const closed = create({ weekdays: [0] });
    expect(
      service.dayAvailability(resident, closed.id, {
        date: '2027-01-02',
        attendees: 2,
      }).unavailableReason?.code,
    ).toBe('CLOSED_DAY');
    const limited = create({ maxActiveBookings: 1 });
    book(limited.id);
    expect(
      service.dayAvailability(resident, limited.id, {
        date: '2027-01-03',
        attendees: 2,
      }).unavailableReason?.code,
    ).toBe('BOOKING_LIMIT');
  });
});
