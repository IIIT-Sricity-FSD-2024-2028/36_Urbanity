import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Response } from 'supertest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { SEEDED_USERS } from '../src/data/urbanity.resources';
import { LoggingService } from '../src/common/logging/logging.service';
import { LOG_DIRECTORY } from '../src/common/logging/logging.constants';
import { validationPipe } from '../src/common/pipes/validation.pipe';
import { RentalsService } from '../src/modules/rentals/rentals.service';
import type { User } from '../src/data/schemas';
const data = <T>(r: Response) => (r.body as { data: T }).data;
type Listing = ReturnType<RentalsService['createListing']>;
type Lease = ReturnType<RentalsService['createLease']>;
const empty = '40000000-0000-4000-8000-000000000021';
const owner = SEEDED_USERS.find((u) => u.email === 'resident@urbanity.local')!;
const tenant = SEEDED_USERS.find(
  (u) => u.email === 'resident.two@urbanity.local',
)!;
const date = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe('F02 authenticated rental and occupancy contracts', () => {
  let app: INestApplication, logs: string;
  const auth = (email: string) => {
    const u = SEEDED_USERS.find((u) => u.email === email)!;
    return `Bearer ${app.get(JwtService).sign({ sub: u.id })}`;
  };
  const admin = () => auth('community.admin@urbanity.local'),
    landlord = () => auth(owner.email),
    renter = () => auth(tenant.email),
    adminB = () => auth('community.admin.b@urbanity.local');
  const post = (path: string, token: string, body: object = {}) =>
    request(app.getHttpServer() as App)
      .post(path)
      .set('Authorization', token)
      .send(body);
  const get = (path: string, token: string) =>
    request(app.getHttpServer() as App)
      .get(path)
      .set('Authorization', token);
  const patch = (path: string, token: string, body: object) =>
    request(app.getHttpServer() as App)
      .patch(path)
      .set('Authorization', token)
      .send(body);
  const communityListing = async () => {
    const listing = data<Listing>(
      await post('/rentals/listings', admin(), {
        apartmentId: empty,
        arrangement: 'COMMUNITY',
        monthlyRent: 8000,
        securityDeposit: 16000,
        availableFrom: date(-1),
      }).expect(201),
    );
    await patch(`/rentals/listings/${listing.id}`, admin(), {
      status: 'AVAILABLE',
    }).expect(200);
    return listing;
  };
  const proposal = async (listingId: string, tenantId = tenant.id) =>
    data<Lease>(
      await post('/rentals/tenant-onboarding', admin(), {
        listingId,
        existingTenantId: tenantId,
        clientRequestId: randomUUID(),
        startDate: date(0),
        endDate: date(30),
        dueDay: 5,
      }).expect(201),
    );
  beforeEach(async () => {
    logs = await mkdtemp(join(tmpdir(), 'urbanity-f02-'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOG_DIRECTORY)
      .useValue(logs)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => {
    await app?.get(LoggingService).flush();
    await app?.close();
    await rm(logs, { recursive: true, force: true, maxRetries: 3 });
  });
  it('disables private workflows, rejects resident management and keeps all data community-scoped', async () => {
    const body = {
      apartmentId: empty,
      arrangement: 'COMMUNITY',
      monthlyRent: 8000,
      securityDeposit: 16000,
      availableFrom: date(-1),
    };
    await post('/rentals/listings', landlord(), body).expect(403);
    await post('/rentals/listings', admin(), {
      ...body,
      arrangement: 'OWNER',
    }).expect(400);
    await post('/rentals/listings', adminB(), body).expect(403);
    await post(`/rentals/listings/${randomUUID()}/review`, admin(), {
      decision: 'APPROVED',
      reason: 'removed',
    }).expect(404);
    const listing = await communityListing();
    await patch(`/rentals/listings/${listing.id}`, landlord(), {
      monthlyRent: 1,
    }).expect(403);
    await patch(`/rentals/listings/${listing.id}`, adminB(), {
      monthlyRent: 1,
    }).expect(403);
    await post('/rentals/leases', landlord(), {
      listingId: listing.id,
      tenantId: tenant.id,
      startDate: date(0),
      endDate: date(30),
      dueDay: 1,
    }).expect(403);
  });
  it('reuses an existing resident without duplication and enforces tenant acceptance before activation', async () => {
    const listing = await communityListing(),
      before = data<User[]>(await get('/users', admin()).expect(200)).length;
    const lease = await proposal(listing.id);
    expect(data<User[]>(await get('/users', admin()).expect(200))).toHaveLength(
      before,
    );
    expect(lease.adminApprovedBy).toBe(
      SEEDED_USERS.find((u) => u.email === 'community.admin@urbanity.local')!
        .id,
    );
    await post(`/rentals/managed/leases/${lease.id}/activate`, admin()).expect(
      400,
    );
    await post(
      `/rentals/managed/leases/${lease.id}/activate`,
      landlord(),
    ).expect(403);
    await post(`/rentals/me/leases/${lease.id}/accept`, landlord()).expect(404);
    await post(`/rentals/me/leases/${lease.id}/accept`, renter()).expect(201);
    await post(`/rentals/managed/leases/${lease.id}/activate`, admin()).expect(
      201,
    );
    const mine = data<ReturnType<RentalsService['myLease']>>(
      await get(`/rentals/me/leases/${lease.id}`, renter()).expect(200),
    );
    expect(mine.obligations).toHaveLength(1);
    expect(mine.obligations[0].payeeId).toBe(mine.payeeId);
    expect(mine.payments).toHaveLength(0);
    await post('/rentals/listings', admin(), {
      apartmentId: empty,
      arrangement: 'COMMUNITY',
      monthlyRent: 1,
      securityDeposit: 0,
      availableFrom: date(0),
    }).expect(409);
    await get('/amenities', renter()).expect(200);
    await get(`/rentals/me/leases/${lease.id}`, landlord()).expect(404);
    await post(`/rentals/leases/${lease.id}/review`, adminB(), {
      decision: 'APPROVED',
      reason: 'foreign',
    }).expect(403);
    await patch(`/users/${tenant.id}`, renter(), {
      role: 'COMMUNITY_ADMIN',
    }).expect(403);
  });
  it('creates owner-occupants without rent and denies duplicate owner assignment or role escalation', async () => {
    const user = data<User>(
      await post('/users', admin(), {
        name: 'New owner',
        email: 'owner.new@test.local',
        password: 'typed-password',
        role: 'RESIDENT',
        apartmentId: empty,
        residentSituation: 'OWNER_OCCUPANT',
      }).expect(201),
    );
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
    const token = `Bearer ${app.get(JwtService).sign({ sub: user.id })}`;
    expect(
      data<{ leases: Lease[] }>(await get('/rentals/me', token).expect(200))
        .leases,
    ).toHaveLength(0);
    await get('/amenities', token).expect(200);
    await post('/users', admin(), {
      name: 'Duplicate owner',
      email: 'owner.duplicate@test.local',
      password: 'typed-password',
      role: 'RESIDENT',
      apartmentId: empty,
      residentSituation: 'OWNER_OCCUPANT',
    }).expect(409);
    await patch(`/users/${user.id}`, token, { role: 'COMMUNITY_ADMIN' }).expect(
      403,
    );
  });
  it('atomically onboards community tenants, reuses retries and snapshots the authorized rent payee', async () => {
    const listing = data<Listing>(
      await post('/rentals/listings', admin(), {
        apartmentId: empty,
        arrangement: 'COMMUNITY',
        monthlyRent: 8000,
        securityDeposit: 16000,
        availableFrom: date(-1),
      }).expect(201),
    );
    await patch(`/rentals/listings/${listing.id}`, admin(), {
      status: 'AVAILABLE',
    }).expect(200);
    const body = {
      listingId: listing.id,
      clientRequestId: randomUUID(),
      account: {
        name: 'Prospective tenant',
        email: 'new.tenant@test.local',
        password: 'typed-password',
        role: 'RESIDENT',
      },
      startDate: date(0),
      endDate: date(30),
      dueDay: 5,
    };
    const response = await post('/rentals/tenant-onboarding', admin(), body);
    expect(response.status).toBe(201);
    const lease = data<Lease>(response);
    expect(
      data<Lease>(
        await post('/rentals/tenant-onboarding', admin(), body).expect(201),
      ).id,
    ).toBe(lease.id);
    const token = `Bearer ${app.get(JwtService).sign({ sub: lease.tenantId })}`;
    await get('/amenities', token).expect(403);
    await post(`/rentals/me/leases/${lease.id}/accept`, token).expect(201);
    await post(`/rentals/managed/leases/${lease.id}/activate`, admin()).expect(
      201,
    );
    await get('/amenities', token).expect(200);
    const mine = data<ReturnType<RentalsService['myLease']>>(
      await get(`/rentals/me/leases/${lease.id}`, token).expect(200),
    );
    expect(mine.payeeId).toBe(
      SEEDED_USERS.find((u) => u.email === 'community.admin@urbanity.local')!
        .id,
    );
    expect(mine.payments).toHaveLength(0);
    await post(
      `/rentals/me/leases/${lease.id}/obligations/${mine.obligations[0].id}/payment-evidence`,
      token,
      {
        amount: 1,
        transactionReference: 'tenant-reference',
        payeeId: owner.id,
      },
    ).expect(400);
  });
  it('serializes competing community proposals and repeated admin approvals', async () => {
    const listing = await communityListing();
    const body = {
      listingId: listing.id,
      tenantId: tenant.id,
      startDate: date(0),
      endDate: date(30),
      dueDay: 1,
    };
    const results = await Promise.all([
      post('/rentals/leases', admin(), body),
      post('/rentals/leases', admin(), body),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const lease = data<Lease>(results.find((r) => r.status === 201)!);
    const reviews = await Promise.all([
      post(`/rentals/leases/${lease.id}/review`, admin(), {
        decision: 'APPROVED',
        reason: 'first',
      }),
      post(`/rentals/leases/${lease.id}/review`, admin(), {
        decision: 'APPROVED',
        reason: 'retry',
      }),
    ]);
    expect(reviews.map((r) => r.status)).toEqual([201, 201]);
    expect(
      data<Lease[]>(await get('/rentals/managed/leases', admin()).expect(200)),
    ).toHaveLength(1);
    await post(`/rentals/me/leases/${lease.id}/accept`, renter()).expect(201);
    await post(`/rentals/managed/leases/${lease.id}/activate`, admin()).expect(
      201,
    );
    const mine = data<ReturnType<RentalsService['myLease']>>(
      await get(`/rentals/me/leases/${lease.id}`, renter()).expect(200),
    );
    await post(
      `/rentals/me/leases/${lease.id}/obligations/${mine.obligations[0].id}/payment-evidence`,
      landlord(),
      { amount: 1, transactionReference: 'foreign' },
    ).expect(404);
    await post(`/rentals/payments/${randomUUID()}/verify`, renter()).expect(
      404,
    );
  });
  it('preserves paid-service history and blocks successor handover until unfinished work is explicitly cancelled', async () => {
    const listing = await communityListing();
    const lease = data<Lease>(
      await post('/rentals/tenant-onboarding', admin(), {
        listingId: listing.id,
        clientRequestId: randomUUID(),
        account: {
          name: 'First tenant',
          email: 'first.tenant@test.local',
          password: 'typed-password',
          role: 'RESIDENT',
        },
        startDate: date(0),
        endDate: date(30),
        dueDay: 5,
      }).expect(201),
    );
    const token = `Bearer ${app.get(JwtService).sign({ sub: lease.tenantId })}`;
    await post(`/rentals/me/leases/${lease.id}/accept`, token).expect(201);
    await post(`/rentals/managed/leases/${lease.id}/activate`, admin()).expect(
      201,
    );
    const catalogue = data<{ id: string }>(
      await post('/paid-services/catalogue', admin(), {
        name: 'Repair',
        description: 'Repair work',
        specialization: 'PLUMBING',
        startingPricePaise: 5000,
        active: true,
      }).expect(201),
    );
    const work = data<{ id: string; version: number; apartmentId: string }>(
      await post('/paid-services/requests', token, {
        catalogueId: catalogue.id,
        clientRequestId: randomUUID(),
        description: 'Tenant repair',
      }).expect(201),
    );
    expect(work.apartmentId).toBe(empty);
    const ending = data<{ id: string }>(
      await post(
        `/rentals/me/leases/${lease.id}/requests/TERMINATION`,
        token,
      ).expect(201),
    );
    await post(`/rentals/requests/${ending.id}/decision`, admin(), {
      decision: 'APPROVED',
    }).expect(201);
    await get('/amenities', token).expect(403);
    await post('/paid-services/requests', token, {
      catalogueId: catalogue.id,
      clientRequestId: randomUUID(),
      description: 'No longer occupant',
    }).expect(403);
    const nextListing = await communityListing(),
      next = await proposal(nextListing.id);
    await post(`/rentals/me/leases/${next.id}/accept`, renter()).expect(201);
    await post(`/rentals/managed/leases/${next.id}/activate`, admin()).expect(
      400,
    );
    await post(`/paid-services/requests/${work.id}/cancel`, token, {
      version: work.version,
    }).expect(201);
    await post(`/rentals/managed/leases/${next.id}/activate`, admin()).expect(
      201,
    );
    await get(`/paid-services/requests/${work.id}`, token).expect(200);
    expect(
      data<ReturnType<RentalsService['myLease']>>(
        await get(`/rentals/me/leases/${lease.id}`, token).expect(200),
      ).status,
    ).toBe('TERMINATED');
  });
});
