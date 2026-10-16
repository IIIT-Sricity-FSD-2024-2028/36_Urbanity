import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import type {
  AmenityBooking,
  MaintenanceBlock,
} from '../src/modules/amenities/amenities.types';
import { LoggingService } from '../src/common/logging/logging.service';
const payload = <T>(response: Response): T =>
  (response.body as { data: T }).data;
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { SEEDED_USERS } from '../src/data/urbanity.resources';
import { LOG_DIRECTORY } from '../src/common/logging/logging.constants';
import { validationPipe } from '../src/common/pipes/validation.pipe';

const config = {
  name: 'Community hall',
  description: 'Events',
  status: 'ACTIVE',
  timeZone: 'UTC',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  opensAt: '08:00',
  closesAt: '22:00',
  capacity: 10,
  exclusive: true,
  minDurationMinutes: 30,
  maxDurationMinutes: 120,
  maxActiveBookings: 3,
  advanceDays: 0,
  requiresApproval: true,
  feeMinor: 5000,
  depositMinor: 10000,
};
const slot = (hour = 10, end = hour + 1, days = 1) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  const finish = new Date(date);
  finish.setUTCHours(end, 0, 0, 0);
  return {
    startsAt: date.toISOString(),
    endsAt: finish.toISOString(),
    attendees: 2,
  };
};
const price = { expectedFeeMinor: 5000, expectedDepositMinor: 10000 };
describe('F05 amenity HTTP contracts', () => {
  let app: INestApplication, logs: string;
  let admin: string,
    resident: string,
    otherResident: string,
    adminB: string,
    residentB: string;
  const auth = (email: string) => {
    const u = SEEDED_USERS.find((u) => u.email === email)!;
    return `Bearer ${app.get(JwtService).sign({ sub: u.id })}`;
  };
  const post = (path: string, token: string, body: object) =>
    request(app.getHttpServer() as App)
      .post(path)
      .set('Authorization', token)
      .send(body);
  const patch = (path: string, token: string, body: object) =>
    request(app.getHttpServer() as App)
      .patch(path)
      .set('Authorization', token)
      .send(body);
  const create = async (changes = {}) =>
    payload<{ id: string }>(
      await post('/amenities', admin, { ...config, ...changes }).expect(201),
    ).id;
  const book = (id: string, body = {}, token = resident) =>
    post(`/amenities/${id}/bookings`, token, { ...slot(), ...price, ...body });
  beforeEach(async () => {
    logs = await mkdtemp(join(tmpdir(), 'urbanity-f05-'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOG_DIRECTORY)
      .useValue(logs)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
    admin = auth('community.admin@urbanity.local');
    resident = auth('resident@urbanity.local');
    otherResident = auth('resident.two@urbanity.local');
    adminB = auth('community.admin.b@urbanity.local');
    residentB = auth('resident.b@urbanity.local');
  });
  afterEach(async () => {
    await app?.get(LoggingService).flush();
    await app?.close();
    await rm(logs, { recursive: true, force: true });
  });
  it('creates, edits and scopes amenities; rejects unauthenticated and unauthorized roles', async () => {
    await request(app.getHttpServer() as App)
      .get('/amenities')
      .expect(401);
    for (const token of [
      resident,
      auth('maintenance.worker@urbanity.local'),
      auth('tower.representative@urbanity.local'),
    ]) {
      await post('/amenities', token, config).expect(403);
    }
    const id = await create();
    await patch(`/amenities/${id}`, admin, {
      ...config,
      name: 'Updated hall',
    }).expect(200);
    await patch(`/amenities/${id}`, adminB, config).expect(403);
    await post(`/amenities/${id}/availability`, residentB, slot()).expect(403);
    await book(id, {}, residentB).expect(403);
    const list = await request(app.getHttpServer() as App)
      .get('/amenities')
      .set('Authorization', residentB)
      .expect(200);
    expect(payload<unknown[]>(list)).toEqual([]);
    await patch(`/amenities/${id}`, admin, {
      ...config,
      timeZone: 'Invalid/Zone',
    }).expect(400);
    await post('/amenities', admin, {
      ...config,
      communityId: 'client-scope',
    }).expect(400);
  });
  it('validates fee integers, nulls, ranges and unrecognized booking fields', async () => {
    for (const feeMinor of [-1, 1.5, null, 100000001])
      await post('/amenities', admin, { ...config, feeMinor }).expect(400);
    await post('/amenities', admin, {
      ...config,
      minDurationMinutes: 150,
      maxDurationMinutes: 120,
    }).expect(400);
    await post('/amenities', admin, {
      ...config,
      opensAt: '22:00',
      closesAt: '08:00',
    }).expect(400);
    const id = await create();
    await book(id, { expectedFeeMinor: 1 }).expect(409);
    await book(id, { paymentStatus: 'PAID' }).expect(400);
    await book(id, { residentId: 'fake' }).expect(400);
    await book(id, { startsAt: null }).expect(400);
  });
  it('enforces operating hours, duration, capacity, advance window, closed days and status', async () => {
    const id = await create();
    for (const values of [
      slot(7, 8),
      slot(21, 23),
      slot(10, 13),
      slot(10, 10),
      slot(10, 11, -1),
      { ...slot(), attendees: 11 },
      { ...slot(), attendees: 0 },
    ]) {
      await post(`/amenities/${id}/availability`, resident, values).expect(400);
      await book(id, values).expect(400);
    }
    const short = slot();
    short.endsAt = new Date(
      Date.parse(short.startsAt) + 15 * 60000,
    ).toISOString();
    await book(id, short).expect(400);
    const weekday = new Date(slot().startsAt).getUTCDay();
    await patch(`/amenities/${id}`, admin, {
      ...config,
      weekdays: [(weekday + 1) % 7],
    }).expect(200);
    await book(id).expect(400);
    await patch(`/amenities/${id}`, admin, {
      ...config,
      status: 'INACTIVE',
    }).expect(200);
    await book(id).expect(409);
  });
  it('serializes simultaneous exclusive requests and lets adjacent bookings proceed', async () => {
    const id = await create();
    const results = await Promise.all([book(id), book(id, {}, otherResident)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    await book(id, slot(11, 12)).expect(201);
    await post(`/amenities/${id}/availability`, resident, slot()).expect(409);
  });
  it('uses peak simultaneous occupancy for shared capacity and counts pending holds', async () => {
    const id = await create({ exclusive: false, capacity: 5 });
    await book(id, { ...slot(10, 11), attendees: 3 }).expect(201);
    await book(id, { ...slot(11, 12), attendees: 3 }).expect(201);
    await book(id, { ...slot(10, 12), attendees: 2 }, otherResident).expect(
      201,
    );
    await book(id, { ...slot(10, 11), attendees: 1 }, otherResident).expect(
      409,
    );
  });
  it('enforces resident booking limits and frees capacity after cancellation', async () => {
    const id = await create({ maxActiveBookings: 1 });
    const b = payload<AmenityBooking>(await book(id).expect(201));
    await book(id, slot(12, 13)).expect(409);
    await patch(`/amenity-bookings/${b.id}/cancel`, resident, {
      reason: 'Plans changed',
    }).expect(200);
    await book(id, slot(12, 13)).expect(201);
  });
  it('authorizes approval/rejection/cancellation and retains fee and cancellation history', async () => {
    const id = await create();
    const b = payload<AmenityBooking>(await book(id).expect(201));
    expect(b).toMatchObject({
      status: 'PENDING_APPROVAL',
      paymentStatus: 'PENDING',
      feeMinor: 5000,
      depositMinor: 10000,
    });
    await patch(`/amenity-bookings/${b.id}/approve`, resident, {
      reason: 'Approve',
    }).expect(403);
    await patch(`/amenity-bookings/${b.id}/approve`, adminB, {
      reason: 'Approve',
    }).expect(403);
    await patch(`/amenity-bookings/${b.id}/cancel`, otherResident, {
      reason: 'Cancel',
    }).expect(403);
    await patch(`/amenity-bookings/${b.id}/approve`, admin, {
      reason: 'Reviewed',
    }).expect(200);
    await patch(`/amenity-bookings/${b.id}/approve`, admin, {
      reason: 'Again',
    }).expect(409);
    await patch(`/amenities/${id}`, admin, { ...config, capacity: 1 }).expect(
      409,
    );
    await patch(`/amenities/${id}`, admin, {
      ...config,
      feeMinor: 6000,
    }).expect(200);
    const result = await patch(`/amenity-bookings/${b.id}/cancel`, resident, {
      reason: 'Plans changed',
    }).expect(200);
    expect(payload<AmenityBooking>(result)).toMatchObject({
      status: 'CANCELLED',
      feeMinor: 5000,
      paymentStatus: 'VOIDED',
    });
    expect(payload<AmenityBooking>(result).history).toHaveLength(3);
    expect(payload<AmenityBooking>(result).paymentHistory).toHaveLength(2);
    await patch(`/amenity-bookings/${b.id}/cancel`, resident, {
      reason: 'Again',
    }).expect(409);
    const b2 = payload<AmenityBooking>(
      await book(id, { expectedFeeMinor: 6000 }).expect(201),
    );
    await patch(`/amenity-bookings/${b2.id}/reject`, admin, {
      reason: 'Unavailable for event',
    }).expect(200);
    const own = await request(app.getHttpServer() as App)
      .get('/amenity-bookings')
      .set('Authorization', otherResident)
      .expect(200);
    expect(payload<unknown[]>(own)).toEqual([]);
  });
  it('supports zero fees and automatic approval without simulating a payment', async () => {
    const id = await create({
      requiresApproval: false,
      feeMinor: 0,
      depositMinor: 0,
    });
    const b = await book(id, {
      expectedFeeMinor: 0,
      expectedDepositMinor: 0,
    }).expect(201);
    expect(payload<AmenityBooking>(b)).toMatchObject({
      status: 'APPROVED',
      paymentStatus: 'NOT_REQUIRED',
    });
  });
  it('authorizes maintenance blocks, prevents booking/block conflicts and preserves released blocks', async () => {
    const id = await create();
    const { startsAt, endsAt } = slot();
    const window = { startsAt, endsAt };
    const block = { ...window, reason: 'Pool repair' };
    await post(`/amenities/${id}/blocks`, resident, block).expect(403);
    await post(`/amenities/${id}/blocks`, adminB, block).expect(403);
    const b = payload<MaintenanceBlock>(
      await post(`/amenities/${id}/blocks`, admin, block).expect(201),
    );
    await book(id).expect(409);
    await post(`/amenities/${id}/blocks`, admin, block).expect(409);
    await patch(`/amenities/${id}/blocks/${b.id}/release`, adminB, {}).expect(
      403,
    );
    await patch(`/amenities/${id}/blocks/${b.id}/release`, admin, {}).expect(
      200,
    );
    await book(id).expect(201);
    await post(`/amenities/${id}/blocks`, admin, block).expect(409);
    const history = await request(app.getHttpServer() as App)
      .get(`/amenities/${id}/blocks`)
      .set('Authorization', resident)
      .expect(200);
    expect(payload<MaintenanceBlock[]>(history)[0].releasedAt).toBeTruthy();
    expect(payload<MaintenanceBlock[]>(history)[0].createdBy).toBeUndefined();
  });
  it('interprets operating hours in the facility time zone', async () => {
    const id = await create({
      timeZone: 'Asia/Kolkata',
      opensAt: '15:30',
      closesAt: '16:30',
    });
    await book(id, slot(10, 11)).expect(201);
    await book(id, slot(11, 12)).expect(400);
  });
  it('returns date-based choices and enforces granularity, buffers, real dates and manager-only rules', async () => {
    const id = await create({
      bookingIntervalMinutes: 15,
      turnaroundMinutes: 15,
      allowExtensions: true,
    });
    const date = slot().startsAt.slice(0, 10);
    await book(id).expect(201);
    const day = payload<{
      starts: { value: string }[];
      ends: { value: string }[];
      unavailable: object[];
    }>(
      await post(`/amenities/${id}/availability/day`, otherResident, {
        date,
        attendees: 2,
        startsAt: slot(12, 13).startsAt,
      }).expect(201),
    );
    expect(day.starts.some((s) => s.value === slot(11, 12).startsAt)).toBe(
      false,
    );
    expect(day.starts.some((s) => s.value === slot(12, 13).startsAt)).toBe(
      true,
    );
    expect(day.ends.length).toBeGreaterThan(0);
    expect(JSON.stringify(day.unavailable)).not.toMatch(
      /residentId|apartmentId|createdBy/,
    );
    await post(`/amenities/${id}/availability/day`, residentB, {
      date,
      attendees: 2,
    }).expect(403);
    await post(`/amenities/${id}/availability/day`, resident, {
      date: '2027-02-30',
      attendees: 2,
    }).expect(400);
    const offGrid = {
      ...slot(12, 13),
      startsAt: new Date(
        Date.parse(slot(12, 13).startsAt) + 60000,
      ).toISOString(),
    };
    await book(id, offGrid).expect(400);
    await book(id, slot(11, 12), otherResident).expect(409);
    await book(id, { startsAt: '2027-02-30T10:00:00Z' }).expect(400);
    await post('/amenities', admin, {
      ...config,
      bookingIntervalMinutes: 0,
    }).expect(400);
    await post('/amenities', admin, {
      ...config,
      bookingIntervalMinutes: null,
    }).expect(400);
    await post('/amenities', admin, {
      ...config,
      turnaroundMinutes: -1,
    }).expect(400);
    await post('/amenities', admin, {
      ...config,
      allowExtensions: 'yes',
    }).expect(400);
    await post('/amenities', admin, {
      ...config,
      bookingIntervalMinutes: 60,
      minDurationMinutes: 31,
      maxDurationMinutes: 45,
    }).expect(400);
    await patch(`/amenities/${id}`, resident, {
      ...config,
      allowExtensions: true,
    }).expect(403);
  });
  it('quotes a separate extension fee, preserves the deposit and requires scoped approval before charging', async () => {
    const id = await create({ allowExtensions: true, maxDurationMinutes: 180 });
    let b = payload<AmenityBooking>(await book(id).expect(201));
    b = payload<AmenityBooking>(
      await patch(`/amenity-bookings/${b.id}/approve`, admin, {
        reason: 'Approved',
      }).expect(200),
    );
    const dto = {
      ...slot(10, 12),
      kind: 'EXTEND',
      expectedVersion: b.version,
      clientRequestId: randomUUID(),
    };
    const originalEnd = b.endsAt;
    await post(`/amenity-bookings/${b.id}/changes`, otherResident, dto).expect(
      403,
    );
    await post(`/amenity-bookings/${b.id}/changes`, admin, dto).expect(403);
    await post(`/amenity-bookings/${b.id}/change-availability`, otherResident, {
      date: slot().startsAt.slice(0, 10),
      attendees: 2,
      kind: 'EXTEND',
    }).expect(403);
    const quote = payload<{
      ends: { value: string; additionalFeeMinor: number }[];
    }>(
      await post(`/amenity-bookings/${b.id}/change-availability`, resident, {
        date: slot().startsAt.slice(0, 10),
        attendees: 2,
        kind: 'EXTEND',
      }).expect(201),
    );
    expect(quote.ends.some((e) => e.value === slot(10, 12).endsAt)).toBe(true);
    expect(
      quote.ends.find((e) => e.value === slot(10, 12).endsAt)
        ?.additionalFeeMinor,
    ).toBe(5000);
    b = payload<AmenityBooking>(
      await post(`/amenity-bookings/${b.id}/changes`, resident, dto).expect(
        201,
      ),
    );
    expect(b.endsAt).toBe(originalEnd);
    expect(b.changes[0].status).toBe('PENDING_APPROVAL');
    expect(b.paymentHistory).toHaveLength(1);
    const retry = payload<AmenityBooking>(
      await post(`/amenity-bookings/${b.id}/changes`, resident, dto).expect(
        201,
      ),
    );
    expect(retry.changes).toHaveLength(1);
    await book(id, slot(11, 12), otherResident).expect(409);
    await post(`/amenities/${id}/blocks`, admin, {
      startsAt: slot(11, 12).startsAt,
      endsAt: slot(11, 12).endsAt,
      reason: 'Maintenance',
    }).expect(409);
    const path = `/amenity-bookings/${b.id}/changes/${b.changes[0].id}/approve`;
    await patch(path, resident, { reason: 'Fake' }).expect(403);
    await patch(path, adminB, { reason: 'Wrong community' }).expect(403);
    b = payload<AmenityBooking>(
      await patch(path, admin, { reason: 'Space available' }).expect(200),
    );
    expect(b.endsAt).toBe(slot(10, 12).endsAt);
    expect(b.feeMinor).toBe(5000);
    expect(b.depositMinor).toBe(10000);
    expect(b.extensionCharges).toHaveLength(1);
    expect(b.extensionCharges[0]).toMatchObject({
      amountMinor: 5000,
      paymentStatus: 'PENDING',
    });
    expect(b.paymentHistory).toHaveLength(2);
    expect(
      payload<AmenityBooking>(
        await patch(path, admin, { reason: 'Retry' }).expect(200),
      ).version,
    ).toBe(b.version);
  });
  it('rejects conflicting and stale extensions without losing the original, and supports pending edit rejection', async () => {
    const id = await create({ allowExtensions: true, maxDurationMinutes: 180 });
    let b = payload<AmenityBooking>(await book(id).expect(201));
    b = payload<AmenityBooking>(
      await patch(`/amenity-bookings/${b.id}/approve`, admin, {
        reason: 'Approve',
      }).expect(200),
    );
    await book(id, slot(11, 12), otherResident).expect(201);
    const dto = {
      ...slot(10, 12),
      kind: 'EXTEND',
      expectedVersion: b.version,
      clientRequestId: randomUUID(),
    };
    await post(`/amenity-bookings/${b.id}/changes`, resident, dto).expect(409);
    await post(`/amenity-bookings/${b.id}/changes`, resident, {
      ...dto,
      expectedVersion: 999,
    }).expect(409);
    await post(`/amenity-bookings/${b.id}/changes`, resident, {
      ...dto,
      attendees: 1,
    }).expect(400);
    b = payload<AmenityBooking>(
      await post(`/amenity-bookings/${b.id}/changes`, resident, {
        ...dto,
        ...slot(14, 15),
        kind: 'EDIT',
        clientRequestId: randomUUID(),
      }).expect(201),
    );
    expect(b.endsAt).toBe(slot().endsAt);
    await book(id, slot(14, 15), otherResident).expect(409);
    b = payload<AmenityBooking>(
      await patch(
        `/amenity-bookings/${b.id}/changes/${b.changes[0].id}/reject`,
        admin,
        { reason: 'Original time preferred' },
      ).expect(200),
    );
    expect(b.endsAt).toBe(slot().endsAt);
    await book(id, slot(14, 15), otherResident).expect(201);
  });
  it('deduplicates concurrent booking retries and serializes an extension competing with a new booking', async () => {
    const id = await create({
      allowExtensions: true,
      requiresApproval: false,
      maxDurationMinutes: 180,
    });
    const clientRequestId = randomUUID();
    const retries = await Promise.all([
      book(id, { clientRequestId }),
      book(id, { clientRequestId }),
    ]);
    expect(retries.map((r) => r.status)).toEqual([201, 201]);
    const b = payload<AmenityBooking>(retries[0]);
    expect(payload<AmenityBooking>(retries[1]).id).toBe(b.id);
    await book(id, { clientRequestId, ...slot(12, 13) }).expect(409);
    const race = await Promise.all([
      post(`/amenity-bookings/${b.id}/changes`, resident, {
        ...slot(10, 12),
        kind: 'EXTEND',
        expectedVersion: b.version,
        clientRequestId: randomUUID(),
      }),
      book(id, slot(11, 12), otherResident),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it('quotes the proportional fee and creates exactly one pending charge under simultaneous approvals', async () => {
    const id = await create({
      feeMinor: 50000,
      allowExtensions: true,
      maxDurationMinutes: 360,
    });
    let b = payload<AmenityBooking>(
      await book(id, { ...slot(10, 12), expectedFeeMinor: 50000 }).expect(201),
    );
    b = payload<AmenityBooking>(
      await patch(`/amenity-bookings/${b.id}/approve`, admin, {
        reason: 'Approve booking',
      }).expect(200),
    );
    expect(b.originalDurationMinutes).toBe(120);
    const quote = payload<{
      ends: { value: string; additionalFeeMinor: number }[];
    }>(
      await post(`/amenity-bookings/${b.id}/change-availability`, resident, {
        kind: 'EXTEND',
        date: b.startsAt.slice(0, 10),
        attendees: 2,
      }).expect(201),
    );
    expect(
      quote.ends.find((end) => end.value === slot(10, 13).endsAt)
        ?.additionalFeeMinor,
    ).toBe(25000);
    expect(
      quote.ends.find(
        (end) =>
          end.value ===
          new Date(Date.parse(slot(10, 12).endsAt) + 30 * 60000).toISOString(),
      )?.additionalFeeMinor,
    ).toBe(12500);
    const dto = {
      ...slot(10, 13),
      kind: 'EXTEND',
      expectedVersion: b.version,
      clientRequestId: randomUUID(),
    };
    await post(`/amenity-bookings/${b.id}/changes`, resident, {
      ...dto,
      extensionFeeMinor: 0,
    }).expect(400);
    b = payload<AmenityBooking>(
      await post(`/amenity-bookings/${b.id}/changes`, resident, dto).expect(
        201,
      ),
    );
    expect(b.extensionCharges).toHaveLength(0);
    expect(b.changes[0].extensionFeeMinor).toBe(25000);
    const path = `/amenity-bookings/${b.id}/changes/${b.changes[0].id}/approve`;
    const approvals = await Promise.all([
      patch(path, admin, { reason: 'Approve extension' }),
      patch(path, admin, { reason: 'Retry approval' }),
    ]);
    expect(approvals.map((r) => r.status)).toEqual([200, 200]);
    for (const response of approvals) {
      const result = payload<AmenityBooking>(response);
      expect(result.extensionCharges).toHaveLength(1);
      expect(result.extensionCharges[0]).toMatchObject({
        amountMinor: 25000,
        paymentStatus: 'PENDING',
      });
      expect(result.feeMinor).toBe(50000);
      expect(result.depositMinor).toBe(10000);
      expect(result.paymentStatus).toBe('PENDING');
      expect(result.paymentHistory.filter((e) => e.chargeId)).toHaveLength(1);
    }
    b = payload<AmenityBooking>(
      await post(`/amenity-bookings/${b.id}/changes`, resident, dto).expect(
        201,
      ),
    );
    expect(b.extensionCharges).toHaveLength(1);
    await post(`/amenity-bookings/${b.id}/changes`, resident, {
      ...dto,
      kind: 'EDIT',
      endsAt: slot(10, 14).endsAt,
      expectedVersion: b.version,
      clientRequestId: randomUUID(),
    }).expect(400);
    b = payload<AmenityBooking>(
      await patch(`/amenity-bookings/${b.id}/cancel`, resident, {
        reason: 'Cancel before start',
      }).expect(200),
    );
    expect(b.extensionCharges[0].paymentStatus).toBe('VOIDED');
    expect(
      b.paymentHistory.filter((e) => e.chargeId).map((e) => e.status),
    ).toEqual(['PENDING', 'VOIDED']);
  });

  it('enforces minimum notice on direct APIs and accepts reservations further in the future', async () => {
    const created = payload<{ id: string }>(
      await post('/amenities', admin, { ...config, advanceDays: 7 }).expect(
        201,
      ),
    );
    const early = slot(10, 11, 1),
      later = slot(10, 11, 15);
    const result = payload<{
      bookingWindow: { minDate: string; earliestStartsAt: string };
      unavailableReason: { code: string };
      starts: unknown[];
    }>(
      await post(`/amenities/${created.id}/availability/day`, resident, {
        date: early.startsAt.slice(0, 10),
        attendees: 2,
      }).expect(201),
    );
    expect(result.starts).toEqual([]);
    expect(result.unavailableReason.code).toBe('MINIMUM_NOTICE');
    expect(result.bookingWindow.earliestStartsAt).toBeDefined();
    await post(`/amenities/${created.id}/bookings`, resident, {
      ...early,
      ...price,
      clientRequestId: randomUUID(),
    }).expect(400);
    await post(`/amenities/${created.id}/bookings`, resident, {
      ...later,
      ...price,
      clientRequestId: randomUUID(),
    }).expect(201);
  });
});
