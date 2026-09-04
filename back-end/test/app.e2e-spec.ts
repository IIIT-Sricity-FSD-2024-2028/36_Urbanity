import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { RoleName } from '../src/common/enums/roles.enum';
import type { ApiResponse } from '../src/common/api-response';
import { SEEDED_USERS, serviceToken } from '../src/data/urbanity.resources';
import { CrudService } from '../src/common/crud/crud.service';
import type { City, User } from '../src/data/schemas';
import { LOG_DIRECTORY } from '../src/common/logging/logging.constants';
import { LoggingService } from '../src/common/logging/logging.service';
import { configureHttpSecurity } from '../src/config/security.config';

jest.setTimeout(20_000);

describe('Urbanity API (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let tokens: Record<RoleName, string>;
  let logDirectory: string;

  const bearer = (role: RoleName) => `Bearer ${tokens[role]}`;
  const tokenFor = (id: string, email: string, role: RoleName) =>
    `Bearer ${app.get(JwtService).sign({ sub: id, email, role })}`;
  const proofImage = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const resolutionBody = (attachmentId: string) => ({
    problemFound: 'The reported issue was confirmed.',
    resolutionSummary: 'The repair was completed and tested.',
    proofAttachmentIds: [attachmentId],
  });
  const uploadResolutionProof = async (complaintId: string, workerToken: string) => {
    const response = await request(server)
      .post(`/complaints/${complaintId}/attachments`)
      .set('Authorization', workerToken)
      .attach('file', proofImage, { filename: 'resolution-proof.png', contentType: 'image/png' })
      .expect(201);
    return response.body.data.id as string;
  };
  const resolveWithProof = async (complaintId: string, workerToken: string) => {
    const attachmentId = await uploadResolutionProof(complaintId, workerToken);
    return request(server)
      .patch(`/complaints/${complaintId}/resolve`)
      .set('Authorization', workerToken)
      .send(resolutionBody(attachmentId))
      .expect(200);
  };
  const verifyResolution = (complaintId: string, authorityToken: string) =>
    request(server)
      .patch(`/complaints/${complaintId}/verify-resolution`)
      .set('Authorization', authorityToken)
      .send({ authorityRating: 5 })
      .expect(200);
  const reviewBody = (rating: number, feedback?: string) => ({
    speedRating: rating,
    qualityRating: rating,
    communicationRating: rating,
    ...(feedback ? { feedback } : {}),
  });

  beforeEach(async () => {
    logDirectory = await mkdtemp(join(tmpdir(), 'urbanity-logs-'));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LOG_DIRECTORY)
      .useValue(logDirectory)
      .compile();

    app = moduleFixture.createNestApplication();
    configureHttpSecurity(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as App;
    tokens = {} as Record<RoleName, string>;

    const accounts = [
      [RoleName.SuperAdmin, 'superadmin@urbanity.local', 'superadmin-dev'],
      [RoleName.CommunityAdmin, 'community.admin@urbanity.local', 'community-admin-dev'],
      [RoleName.TowerRepresentative, 'tower.representative@urbanity.local', 'tower-representative-dev'],
      [RoleName.Resident, 'resident@urbanity.local', 'resident-dev'],
      [RoleName.MaintenanceWorker, 'maintenance.worker@urbanity.local', 'maintenance-worker-dev'],
    ] as const;

    for (const [role, email, password] of accounts) {
      const response = await request(server)
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      tokens[role] = response.body.data.accessToken;
    }

  });

  it('allows the community admin to create and each final role to read cities', async () => {
    const createResponse = await request(server)
      .post('/cities')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({
        name: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
      })
      .expect(201)
      .expect(({ body }) => {
        const responseBody = body as ApiResponse<City>;

        expect(responseBody.success).toBe(true);
        expect(responseBody.data.id).toEqual(expect.any(String));
      });

    const createdCity = createResponse.body as ApiResponse<City>;

    for (const role of Object.values(RoleName)) {
      await request(server)
        .get(`/cities/${createdCity.data.id}`)
        .set('Authorization', bearer(role))
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            success: true,
            data: {
              name: 'Hyderabad',
              state: 'Telangana',
            },
          });
        });
    }
  });

  it('onboards a contracted community, gates setup until mock payment, and enforces capacity', async () => {
    const onboarding = await request(server).post('/communities').set('Authorization', bearer(RoleName.SuperAdmin)).send({
      name: 'Revenue Test Community', address: '1 Subscription Lane', adminName: 'Revenue Admin', adminEmail: 'revenue.admin@urbanity.local', adminPassword: 'revenue-admin-dev', contractedTowers: 2, contractedApartments: 2,
    }).expect(201);
    const { community, admin, subscription } = onboarding.body.data;
    expect(subscription).toMatchObject({ communityId: community.id, contractedTowers: 2, contractedApartments: 2, towerRate: 1000, apartmentRate: 10, amount: 2020, status: 'PAYMENT_PENDING', paymentStatus: 'PENDING' });

    const adminLogin = await request(server).post('/auth/login').send({ email: 'revenue.admin@urbanity.local', password: 'revenue-admin-dev' }).expect(201);
    const adminToken = `Bearer ${adminLogin.body.data.accessToken}`;
    await request(server).get('/subscriptions/me').set('Authorization', adminToken).expect(200).expect(({ body }) => expect(body.data.status).toBe('PAYMENT_PENDING'));
    const towerBody = { communityId: community.id, name: 'Tower One', code: 'ONE' };
    await request(server).post('/towers').set('Authorization', adminToken).send(towerBody).expect(403);
    await request(server).post('/towers').set('Authorization', bearer(RoleName.SuperAdmin)).send(towerBody).expect(403);

    await request(server).post('/subscriptions/me/mock-payment').set('Authorization', adminToken).send({ amount: 1, success: false }).expect(201).expect(({ body }) => expect(body.data).toMatchObject({ status: 'ACTIVE', paymentStatus: 'SUCCESS', amount: 2020 }));
    const towerOne = await request(server).post('/towers').set('Authorization', adminToken).send(towerBody).expect(201);
    await request(server).post('/towers').set('Authorization', adminToken).send({ communityId: community.id, name: 'Tower Two', code: 'TWO' }).expect(201);
    await request(server).post('/towers').set('Authorization', adminToken).send({ communityId: community.id, name: 'Tower Three', code: 'THREE' }).expect(403);
    const floor = await request(server).post('/floors').set('Authorization', adminToken).send({ towerId: towerOne.body.data.id, floorNumber: 1, label: 'Floor 1' }).expect(201);
    await request(server).post('/apartments').set('Authorization', adminToken).send({ floorId: floor.body.data.id, apartmentNumber: '101', label: '101' }).expect(201);
    await request(server).post('/apartments').set('Authorization', adminToken).send({ floorId: floor.body.data.id, apartmentNumber: '102', label: '102' }).expect(201);
    await request(server).post('/apartments').set('Authorization', adminToken).send({ floorId: floor.body.data.id, apartmentNumber: '103', label: '103' }).expect(403);
    const representative = await request(server).post('/users').set('Authorization', adminToken).send({ name: 'First Representative', email: 'revenue.rep@urbanity.local', password: 'representative-dev', role: 'TOWER_REPRESENTATIVE', towerId: towerOne.body.data.id }).expect(201);
    await request(server).patch(`/users/${representative.body.data.id}/representative-tower`).set('Authorization', adminToken).send({ towerId: towerOne.body.data.id }).expect(200);
    const upgrade = await request(server).post('/subscriptions/me/upgrade').set('Authorization', adminToken).send({ contractedTowers: 3, contractedApartments: 4 }).expect(201);
    expect(upgrade.body.data).toMatchObject({ pendingContractedTowers: 3, pendingContractedApartments: 4, pendingUpgradeAmount: 1020 });
    await request(server).post('/subscriptions/me/upgrade/mock-payment').set('Authorization', adminToken).send({ amount: 1 }).expect(201).expect(({ body }) => expect(body.data).toMatchObject({ contractedTowers: 3, contractedApartments: 4, amount: 3040 }));
    await request(server).post('/towers').set('Authorization', adminToken).send({ communityId: community.id, name: 'Tower Three', code: 'THREE' }).expect(201);
    expect(admin.id).toEqual(expect.any(String));
  });

  it('writes sanitized request metadata to an append-only application log', async () => {
    const token = tokens[RoleName.Resident];

    await request(server).get('/').expect(200);
    await request(server)
      .post('/auth/login')
      .set('Authorization', 'Bearer logging-test-token')
      .send({ email: 'resident@urbanity.local', password: 'resident-dev' })
      .expect(201);
    await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await app.get(LoggingService).flush();
    const log = await readFile(join(logDirectory, 'application.log'), 'utf8');

    expect(log).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z INFO GET \/ 200 \d+ms requestId=[0-9a-f-]{36}$/m,
    );
    expect(log).toContain('POST /auth/login 201');
    expect(log).toContain('GET /auth/me 200');
    expect(log).toContain('userId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
    expect(log).not.toContain('resident-dev');
    expect(log).not.toContain('logging-test-token');
    expect(log).not.toContain(token);
  });

  it('applies security headers and an explicit CORS policy without affecting JWT access', async () => {
    const allowedOrigin = 'http://localhost:3001';
    const root = await request(server).get('/').expect(200);
    expect(root.headers['x-content-type-options']).toBe('nosniff');
    expect(root.headers['x-frame-options']).toBeDefined();
    expect(root.headers['referrer-policy']).toBeDefined();
    expect(root.headers['cache-control']).toBe('private, no-store');
    expect(root.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await (request(server) as any)
      .trace('/')
      .expect(405)
      .expect(({ body }: { body: { error: { message: string } } }) => {
        expect(body.error.message).toBe('HTTP method is not allowed');
      });

    const allowed = await request(server)
      .options('/complaints')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(allowed.headers['access-control-allow-headers']).toMatch(/authorization/i);
    expect(allowed.headers['access-control-allow-headers']).toMatch(/content-type/i);
    expect(allowed.headers['access-control-allow-headers']).not.toMatch(/role/i);

    const disallowed = await request(server)
      .get('/')
      .set('Origin', 'https://malicious.example')
      .expect(200);
    expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();

    await request(server)
      .get('/auth/me')
      .set('Authorization', bearer(RoleName.Resident))
      .expect(200);
    await request(server).get('/auth/me').expect(401);
  });

  it('validates complaint route UUIDs before guards while preserving valid complaint requests', async () => {
    const validComplaintId = '60000000-0000-4000-8000-000000000001';
    const residentToken = bearer(RoleName.Resident);

    await request(server)
      .get(`/complaints/${validComplaintId}`)
      .set('Authorization', residentToken)
      .expect(200);
    for (const path of [
      '/complaints/not-a-uuid',
      '/complaints/123/review',
      '/complaints/abc/attachments',
      '/complaints/not-a-uuid/eligible-workers',
    ]) {
      await request(server)
        .get(path)
        .set('Authorization', residentToken)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error).toMatchObject({
            statusCode: 400,
            message: 'Invalid complaint ID',
          });
        });
    }
    await request(server)
      .post('/complaints')
      .set('Authorization', residentToken)
      .send({
        type: 'APARTMENT',
        title: 'Middleware creation regression',
        description: 'A complaint without a route identifier still proceeds.',
        requiredWorkType: 'PLUMBING',
      })
      .expect(201);

    await app.get(LoggingService).flush();
    const applicationLog = await readFile(
      join(logDirectory, 'application.log'),
      'utf8',
    );
    const errorLog = await readFile(join(logDirectory, 'error.log'), 'utf8');
    expect(applicationLog).toContain('WARN GET /complaints/not-a-uuid 400');
    expect(errorLog).toContain(
      'ERROR GET /complaints/not-a-uuid 400',
    );
  });

  it('returns safe error responses and records validation, auth, authorization, and not-found failures', async () => {
    const sensitiveToken = 'Bearer error-log-test-token';
    const validation = await request(server)
      .post('/cities')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({ name: '', password: 'resident-dev' })
      .expect(400);
    const unauthorized = await request(server)
      .get('/complaints')
      .set('Authorization', sensitiveToken)
      .expect(401);
    await request(server)
      .post('/cities')
      .set('Authorization', bearer(RoleName.Resident))
      .send({ name: 'Forbidden city', state: 'Telangana', country: 'India' })
      .expect(403);
    await request(server)
      .get('/users/99999999-9999-4999-8999-999999999999')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(404);
    await request(server).get('/does-not-exist').expect(404);

    expect(validation.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ statusCode: 400, path: '/cities' }),
      }),
    );
    expect(JSON.stringify(validation.body)).not.toMatch(/stack|trace|resident-dev/i);

    await app.get(LoggingService).flush();
    const errorLog = await readFile(join(logDirectory, 'error.log'), 'utf8');
    expect(errorLog).toContain('ERROR POST /cities 400');
    expect(errorLog).toContain('ERROR GET /complaints 401');
    expect(errorLog).toContain('ERROR POST /cities 403');
    expect(errorLog).toContain('ERROR GET /users/99999999-9999-4999-8999-999999999999 404');
    expect(errorLog).toContain('ERROR GET /does-not-exist 404');
    expect(errorLog).not.toContain('resident-dev');
    expect(errorLog).not.toContain('error-log-test-token');
  });

  it('blocks non-admin roles from mutating city records', async () => {
    await request(server)
      .post('/cities')
      .set('Authorization', bearer(RoleName.Resident))
      .send({
        name: 'Unauthorized city',
      })
      .expect(403);
  });

  it('validates request bodies', async () => {
    await request(server)
      .post('/cities')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({
        name: '',
        unknownField: 'blocked by whitelist',
      })
      .expect(400);
  });

  it('requires a valid, unexpired Bearer token and ignores spoofed role headers', async () => {
    await request(server).get('/communities').expect(401);
    await request(server)
      .get('/communities')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    await request(server)
      .get('/communities')
      .set('Authorization', tokens[RoleName.Resident])
      .expect(401);
    await request(server)
      .get('/communities')
      .set('Authorization', `Basic ${tokens[RoleName.Resident]}`)
      .expect(401);

    const expiredToken = app.get(JwtService).sign(
      {
        sub: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        role: RoleName.Resident,
        email: 'resident@urbanity.local',
      },
      { expiresIn: -1 },
    );
    await request(server)
      .get('/communities')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    await request(server)
      .post('/cities')
      .set('Authorization', bearer(RoleName.Resident))
      .set('X-Role', RoleName.CommunityAdmin)
      .send({ name: 'Spoofed City' })
      .expect(403);

    await request(server)
      .get('/auth/me')
      .set('Authorization', bearer(RoleName.Resident))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
          email: 'resident@urbanity.local',
          role: RoleName.Resident,
        });
      });
  });

  it('rejects a token after its user is deleted', async () => {
    const createdUser = await request(server)
      .post('/users')
      .set('Authorization', bearer(RoleName.SuperAdmin))
      .send({
        name: 'Temporary User',
        email: 'temporary.user@urbanity.local',
        password: 'temporary-user-dev',
        role: RoleName.SuperAdmin,
      })
      .expect(201);

    const login = await request(server)
      .post('/auth/login')
      .send({
        email: 'temporary.user@urbanity.local',
        password: 'temporary-user-dev',
      })
      .expect(201);

    await request(server)
      .delete(`/users/${createdUser.body.data.id}`)
      .set('Authorization', bearer(RoleName.SuperAdmin))
      .expect(200);

    await request(server)
      .get('/communities')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(401);
  });

  it('validates user and role values against the final role set', async () => {
    await request(server)
      .post('/users')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({
        name: 'Invalid User',
        email: 'invalid.user@urbanity.local',
        password: 'development-only',
        role: 'citizen',
      })
      .expect(400);

    await request(server)
      .post('/roles')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({ name: 'admin' })
      .expect(400);
  });

  it('establishes Super Admin and multi-community account foundations', async () => {
    const superAdmin = await request(server)
      .post('/auth/login')
      .send({ email: 'superadmin@urbanity.local', password: 'superadmin-dev' })
      .expect(201);
    const payload = app.get(JwtService).verify(superAdmin.body.data.accessToken) as { sub: string; role: RoleName; email: string; exp: number };
    expect(payload).toMatchObject({ role: RoleName.SuperAdmin, email: 'superadmin@urbanity.local' });
    expect(payload.exp).toEqual(expect.any(Number));
    expect(superAdmin.body.data.user).not.toHaveProperty('passwordHash');
    expect(superAdmin.body.data.user).not.toHaveProperty('communityId');
    expect(superAdmin.body.data.user).not.toHaveProperty('towerId');
    expect(superAdmin.body.data.user).not.toHaveProperty('apartmentId');

    const users = await request(server).get('/users').set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    const byEmail = new Map(users.body.data.map((user: User) => [user.email, user]));
    expect(byEmail.get('community.admin@urbanity.local')).toMatchObject({ role: RoleName.CommunityAdmin, communityId: '10000000-0000-4000-8000-000000000001' });
    expect(byEmail.get('community.admin.b@urbanity.local')).toMatchObject({ role: RoleName.CommunityAdmin, communityId: '10000000-0000-4000-8000-000000000002' });
    expect(byEmail.get('maintenance.worker@urbanity.local')).toMatchObject({ role: RoleName.MaintenanceWorker, communityId: '10000000-0000-4000-8000-000000000001' });
    expect(byEmail.get('maintenance.worker.b@urbanity.local')).toMatchObject({ role: RoleName.MaintenanceWorker, communityId: '10000000-0000-4000-8000-000000000002' });
    expect(byEmail.get('tower.representative.b@urbanity.local')).toMatchObject({ towerId: '20000000-0000-4000-8000-000000000011' });
    expect(byEmail.get('resident.b@urbanity.local')).toMatchObject({ apartmentId: '40000000-0000-4000-8000-000000000111' });

    const workers = await request(server).get('/workforce/workers').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    expect(workers.body.data.every((worker: { towerId?: string }) => worker.towerId === undefined)).toBe(true);
    expect(workers.body.data.every((worker: { communityId: string }) => worker.communityId === '10000000-0000-4000-8000-000000000001')).toBe(true);

    const invalidAccounts = [
      [{ name: 'Invalid Super', email: 'invalid.super@urbanity.local', password: 'development-only', role: RoleName.SuperAdmin, communityId: '10000000-0000-4000-8000-000000000001' }, 403],
      [{ name: 'Invalid Admin', email: 'invalid.admin@urbanity.local', password: 'development-only', role: RoleName.CommunityAdmin }, 403],
      [{ name: 'Invalid Worker', email: 'invalid.worker@urbanity.local', password: 'development-only', role: RoleName.MaintenanceWorker, towerId: '20000000-0000-4000-8000-000000000001' }, 400],
    ];
    for (const [account, expectedStatus] of invalidAccounts) {
      await request(server).post('/users').set('Authorization', bearer(RoleName.CommunityAdmin)).send(account).expect(expectedStatus);
    }

    await request(server).post('/auth/register').send({}).expect(404);
  });

  it('isolates hierarchy and users between Community Admin A and Community Admin B', async () => {
    const adminB = (await request(server).post('/auth/login').send({ email: 'community.admin.b@urbanity.local', password: 'community-admin-b-dev' }).expect(201)).body.data.accessToken;
    const b = `Bearer ${adminB}`;
    const communityA = '10000000-0000-4000-8000-000000000001';
    const communityB = '10000000-0000-4000-8000-000000000002';
    const towerB = '20000000-0000-4000-8000-000000000011';
    const floorB = '30000000-0000-4000-8000-000000000111';
    const apartmentB = '40000000-0000-4000-8000-000000000111';
    const residentB = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
    const representativeB = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';

    await request(server).get('/communities').set('Authorization', bearer(RoleName.SuperAdmin)).expect(200).expect(({ body }) => expect(body.data.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([communityA, communityB])));
    await request(server).get('/communities').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200).expect(({ body }) => expect(body.data.map((item: { id: string }) => item.id)).toEqual([communityA]));
    await request(server).get('/communities').set('Authorization', b).expect(200).expect(({ body }) => expect(body.data.map((item: { id: string }) => item.id)).toEqual([communityB]));
    await request(server).get(`/communities/${communityB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).post('/communities').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied', address: 'Denied' }).expect(403);

    await request(server).get('/towers').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200).expect(({ body }) => expect(body.data.every((tower: { communityId: string }) => tower.communityId === communityA)).toBe(true));
    await request(server).get('/floors').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200).expect(({ body }) => expect(body.data).toHaveLength(6));
    await request(server).get('/apartments').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200).expect(({ body }) => expect(body.data).toHaveLength(12));
    await request(server).get(`/towers/${towerB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).get(`/floors/${floorB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).get(`/apartments/${apartmentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).post('/towers').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ communityId: communityB, name: 'Denied Tower', code: 'DX' }).expect(403);
    await request(server).post('/floors').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ towerId: towerB, floorNumber: 9, label: 'Denied' }).expect(403);
    await request(server).post('/apartments').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ floorId: floorB, apartmentNumber: 'D-1', label: 'Denied' }).expect(403);

    const usersA = await request(server).get('/users').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    expect(usersA.body.data.some((user: { id: string }) => [residentB, representativeB].includes(user.id))).toBe(false);
    await request(server).get(`/users/${residentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).patch(`/users/${residentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied' }).expect(403);
    await request(server).delete(`/users/${residentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).post('/users').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied Admin', email: 'denied.admin@urbanity.local', password: 'development-only', role: RoleName.CommunityAdmin, communityId: communityA }).expect(403);
    await request(server).post('/users').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied Super', email: 'denied.super@urbanity.local', password: 'development-only', role: RoleName.SuperAdmin }).expect(403);
    await request(server).patch('/users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ communityId: communityB }).expect(403);
    await request(server).patch('/users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ role: RoleName.SuperAdmin }).expect(403);
    await request(server).patch(`/users/${residentB}/resident-apartment`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ apartmentId: '40000000-0000-4000-8000-000000000011' }).expect(403);
    await request(server).patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/representative-tower').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ towerId: towerB }).expect(403);
  });

  it('isolates complaints, routing, workers, assignments, and worker actions by community', async () => {
    const adminB = (await request(server).post('/auth/login').send({ email: 'community.admin.b@urbanity.local', password: 'community-admin-b-dev' }).expect(201)).body.data.accessToken;
    const residentB = (await request(server).post('/auth/login').send({ email: 'resident.b@urbanity.local', password: 'resident-b-dev' }).expect(201)).body.data.accessToken;
    const workerB = (await request(server).post('/auth/login').send({ email: 'maintenance.worker.b@urbanity.local', password: 'maintenance-worker-b-dev' }).expect(201)).body.data.accessToken;
    const adminBBearer = `Bearer ${adminB}`;
    const residentBBearer = `Bearer ${residentB}`;
    const workerBBearer = `Bearer ${workerB}`;
    const complaintA = '60000000-0000-4000-8000-000000000003';
    const complaintB = '60000000-0000-4000-8000-000000000004';
    const workerA = '50000000-0000-4000-8000-000000000001';
    const workerBId = '50000000-0000-4000-8000-000000000005';

    const [adminAComplaints, adminBComplaints, superComplaints] = await Promise.all([
      request(server).get('/complaints').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200),
      request(server).get('/complaints').set('Authorization', adminBBearer).expect(200),
      request(server).get('/complaints').set('Authorization', bearer(RoleName.SuperAdmin)).expect(200),
    ]);
    expect(adminAComplaints.body.data.every((item: { communityId: string }) => item.communityId === '10000000-0000-4000-8000-000000000001')).toBe(true);
    expect(adminBComplaints.body.data).toEqual([expect.objectContaining({ id: complaintB, communityId: '10000000-0000-4000-8000-000000000002' })]);
    expect(superComplaints.body.data.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([complaintA, complaintB]));

    await request(server).get(`/complaints/${complaintB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).get(`/complaints/${complaintA}`).set('Authorization', adminBBearer).expect(403);
    await request(server).patch(`/complaints/${complaintB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ title: 'Denied' }).expect(403);
    await request(server).delete(`/complaints/${complaintB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).patch(`/complaints/${complaintA}`).set('Authorization', adminBBearer).send({ title: 'Denied' }).expect(403);
    await request(server).delete(`/complaints/${complaintA}`).set('Authorization', adminBBearer).expect(403);
    expect(adminAComplaints.body.data.find((item: { id: string }) => item.id === complaintA)).toMatchObject({ responsibleUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

    const [workersA, workersB, workersSuper] = await Promise.all([
      request(server).get('/workforce/workers').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200),
      request(server).get('/workforce/workers').set('Authorization', adminBBearer).expect(200),
      request(server).get('/workforce/workers').set('Authorization', bearer(RoleName.SuperAdmin)).expect(200),
    ]);
    expect(workersA.body.data.every((item: { communityId: string }) => item.communityId === '10000000-0000-4000-8000-000000000001')).toBe(true);
    expect(workersB.body.data).toEqual([expect.objectContaining({ id: workerBId, communityId: '10000000-0000-4000-8000-000000000002' })]);
    expect(workersSuper.body.data.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([workerA, workerBId]));
    await request(server).get(`/workforce/workers/${workerBId}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).get(`/workforce/workers/${workerA}`).set('Authorization', adminBBearer).expect(403);

    await request(server).patch(`/complaints/${complaintB}/status`).set('Authorization', adminBBearer).send({ status: 'UNDER_REVIEW' }).expect(200);
    const eligibleB = await request(server).get(`/complaints/${complaintB}/eligible-workers`).set('Authorization', adminBBearer).expect(200);
    expect(eligibleB.body.data).toEqual([expect.objectContaining({ id: workerBId, communityId: '10000000-0000-4000-8000-000000000002' })]);
    await request(server).post(`/complaints/${complaintB}/assign`).set('Authorization', adminBBearer).send({ workerId: workerA }).expect(400);
    const assigned = await request(server).post(`/complaints/${complaintB}/assign`).set('Authorization', adminBBearer).send({ workerId: workerBId }).expect(201);
    expect(assigned.body.data).toMatchObject({ status: 'ASSIGNED', assignedWorkerId: workerBId });
    await request(server).patch(`/complaints/${complaintB}/start`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send({}).expect(403);
    await request(server).patch(`/complaints/${complaintB}/start`).set('Authorization', workerBBearer).send({ workerId: workerA }).expect(400);
    await request(server).patch(`/complaints/${complaintB}/start`).set('Authorization', workerBBearer).send({}).expect(200);
    await request(server).patch(`/complaints/${complaintB}/resolve`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send(resolutionBody('90000000-0000-4000-8000-000000000001')).expect(403);
    await resolveWithProof(complaintB, workerBBearer);
    await verifyResolution(complaintB, adminBBearer);
    const resolvedWorker = await request(server).get(`/workforce/workers/${workerBId}`).set('Authorization', adminBBearer).expect(200);
    expect(resolvedWorker.body.data).toMatchObject({ status: 'AVAILABLE', workHistory: [complaintB] });

    await request(server).patch(`/complaints/${complaintA}/status`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ status: 'UNDER_REVIEW' }).expect(200);
    const eligibleA = await request(server).get(`/complaints/${complaintA}/eligible-workers`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    expect(eligibleA.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: workerA, communityId: '10000000-0000-4000-8000-000000000001' })]));
    expect(eligibleA.body.data.some((item: { id: string }) => item.id === workerBId)).toBe(false);
    await request(server).post(`/complaints/${complaintA}/assign`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ workerId: workerBId }).expect(400);
    await request(server).post(`/complaints/${complaintA}/assign`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ workerId: workerA }).expect(201);
    await request(server).patch(`/complaints/${complaintA}/start`).set('Authorization', workerBBearer).send({}).expect(403);
    await request(server).patch(`/complaints/${complaintA}/resolve`).set('Authorization', workerBBearer).send(resolutionBody('90000000-0000-4000-8000-000000000001')).expect(403);
    await request(server).patch(`/complaints/${complaintA}/start`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send({}).expect(200);
    await resolveWithProof(complaintA, bearer(RoleName.MaintenanceWorker));

    await request(server).post('/complaints').set('Authorization', residentBBearer).send({ type: 'COMMUNITY', title: 'Client-selected community', description: 'The server must reject a different community.', requiredWorkType: 'PLUMBING', communityId: '10000000-0000-4000-8000-000000000001' }).expect(400);
    const routedB = await request(server).post('/complaints').set('Authorization', residentBBearer).send({ type: 'COMMUNITY', title: 'Correctly routed Community B issue', description: 'The server derives the resident community before routing.', requiredWorkType: 'PLUMBING' }).expect(201);
    expect(routedB.body.data).toMatchObject({ communityId: '10000000-0000-4000-8000-000000000002', responsibleRole: RoleName.CommunityAdmin, responsibleUserId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2' });
    expect(app.get(JwtService).verify(adminB) as { communityId?: string }).not.toHaveProperty('communityId');

    app.get<CrudService<User, unknown, unknown>>(serviceToken('users')).delete('cccccccc-cccc-4ccc-8ccc-ccccccccccc2');
    await request(server).post('/complaints').set('Authorization', residentBBearer).send({ type: 'COMMUNITY', title: 'No fallback authority', description: 'Missing Community B admin must prevent complaint creation.', requiredWorkType: 'PLUMBING' }).expect(400);
  });

  it('scopes dashboard and reports to the authenticated community and retires sensitive legacy routes', async () => {
    const adminB = (await request(server).post('/auth/login').send({ email: 'community.admin.b@urbanity.local', password: 'community-admin-b-dev' }).expect(201)).body.data.accessToken;
    const adminBBearer = `Bearer ${adminB}`;
    const dashboardA = await request(server).get('/dashboard/summary').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    const dashboardB = await request(server).get('/dashboard/summary').set('Authorization', adminBBearer).expect(200);
    const dashboardSuper = await request(server).get('/dashboard/summary').set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    expect(dashboardA.body.data).toMatchObject({ communityId: '10000000-0000-4000-8000-000000000001', hierarchy: { communities: 1, towers: 3, floors: 6, apartments: 12 }, complaints: { total: 3 }, workforce: { total: 4 } });
    expect(dashboardB.body.data).toMatchObject({ communityId: '10000000-0000-4000-8000-000000000002', hierarchy: { communities: 1, towers: 2, floors: 4, apartments: 8 }, complaints: { total: 1 }, workforce: { total: 1 } });
    expect(dashboardSuper.body.data).toMatchObject({ hierarchy: { communities: 2, towers: 5, floors: 10, apartments: 20 }, complaints: { total: 4 }, workforce: { total: 5 } });
    expect(dashboardSuper.body.data).not.toHaveProperty('communityId');
    await request(server).get('/dashboard/summary').set('Authorization', bearer(RoleName.Resident)).expect(403);

    const reportA = await request(server).get('/reports/overview').set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    const reportB = await request(server).get('/reports/overview').set('Authorization', adminBBearer).expect(200);
    const reportSuper = await request(server).get('/reports/overview').set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    expect(reportA.body.data).toMatchObject({ communityId: '10000000-0000-4000-8000-000000000001', complaints: { total: 3 }, requiredWorkTypes: { PLUMBING: 2, LIFT_MAINTENANCE: 1 } });
    expect(reportB.body.data).toMatchObject({ communityId: '10000000-0000-4000-8000-000000000002', complaints: { total: 1 }, requiredWorkTypes: { PLUMBING: 1 } });
    expect(reportSuper.body.data).toMatchObject({ complaints: { total: 4 }, requiredWorkTypes: { PLUMBING: 3, LIFT_MAINTENANCE: 1 } });
    await request(server).get('/reports/overview').set('Authorization', bearer(RoleName.MaintenanceWorker)).expect(403);

    for (const path of ['/assignments', '/complaint-updates', '/supports', '/feedback']) {
      await request(server).get(path).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(404);
    }
  });

  it('allows Super Admin global user CRUD while preserving Community Admin isolation', async () => {
    const communityA = '10000000-0000-4000-8000-000000000001';
    const communityB = '10000000-0000-4000-8000-000000000002';
    const residentA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    const residentB = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4';
    const superToken = bearer(RoleName.SuperAdmin);
    const globalUsers = await request(server).get('/users').set('Authorization', superToken).expect(200);
    expect(globalUsers.body.data.map((user: { id: string }) => user.id)).toEqual(expect.arrayContaining([residentA, residentB]));
    await request(server).get(`/users/${residentA}`).set('Authorization', superToken).expect(200);
    await request(server).get(`/users/${residentB}`).set('Authorization', superToken).expect(200);

    const adminA2 = await request(server).post('/users').set('Authorization', superToken).send({ name: 'Community A2 Admin', email: 'community.a2.admin@urbanity.local', password: 'development-only-password', role: RoleName.CommunityAdmin, communityId: communityA }).expect(201);
    expect(adminA2.body.data).toMatchObject({ role: RoleName.CommunityAdmin, communityId: communityA });
    expect(adminA2.body.data).not.toHaveProperty('passwordHash');
    await request(server).post('/users').set('Authorization', superToken).send({ name: 'Invalid Scoped Super', email: 'invalid.scoped.super@urbanity.local', password: 'development-only-password', role: RoleName.SuperAdmin, communityId: communityA }).expect(400);
    const globalSuper = await request(server).post('/users').set('Authorization', superToken).send({ name: 'Global Admin', email: 'global.admin@urbanity.local', password: 'development-only-password', role: RoleName.SuperAdmin }).expect(201);
    expect(globalSuper.body.data).toMatchObject({ role: RoleName.SuperAdmin });
    expect(globalSuper.body.data).not.toHaveProperty('communityId');
    await request(server).patch(`/users/${residentB}`).set('Authorization', superToken).send({ name: 'Updated Resident B' }).expect(200).expect(({ body }) => expect(body.data.name).toBe('Updated Resident B'));
    await request(server).delete(`/users/${adminA2.body.data.id}`).set('Authorization', superToken).expect(200);

    await request(server).post('/users').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied B User', email: 'denied.b.user@urbanity.local', password: 'development-only-password', role: RoleName.Resident, apartmentId: '40000000-0000-4000-8000-000000000111' }).expect(403);
    await request(server).post('/users').set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied Admin', email: 'denied.admin@urbanity.local', password: 'development-only-password', role: RoleName.CommunityAdmin, communityId: communityB }).expect(403);
    await request(server).patch(`/users/${residentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ name: 'Denied' }).expect(403);
  });

  it('gives Super Admin global attachment and review visibility without weakening community scope', async () => {
    const complaintA = '60000000-0000-4000-8000-000000000003';
    const complaintB = '60000000-0000-4000-8000-000000000004';
    const adminB = (await request(server).post('/auth/login').send({ email: 'community.admin.b@urbanity.local', password: 'community-admin-b-dev' }).expect(201)).body.data.accessToken;
    const residentB = tokenFor('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 'resident.b@urbanity.local', RoleName.Resident);
    const workerB = tokenFor('cccccccc-cccc-4ccc-8ccc-ccccccccccc5', 'maintenance.worker.b@urbanity.local', RoleName.MaintenanceWorker);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const attachmentA = await request(server).post(`/complaints/${complaintA}/attachments`).set('Authorization', bearer(RoleName.Resident)).attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    const attachmentB = await request(server).post(`/complaints/${complaintB}/attachments`).set('Authorization', residentB).attach('file', png, { filename: 'b.png', contentType: 'image/png' }).expect(201);
    await request(server).get(`/complaints/${complaintA}/attachments/${attachmentA.body.data.id}`).set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    await request(server).get(`/complaints/${complaintB}/attachments/${attachmentB.body.data.id}`).set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    await request(server).get(`/complaints/${complaintB}/attachments`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).get(`/complaints/${complaintA}/attachments`).set('Authorization', `Bearer ${adminB}`).expect(403);

    const resolveAndReview = async (id: string, authority: string, worker: string, resident: string, workerId: string) => {
      await request(server).patch(`/complaints/${id}/status`).set('Authorization', authority).send({ status: 'UNDER_REVIEW' }).expect(200);
      await request(server).post(`/complaints/${id}/assign`).set('Authorization', authority).send({ workerId }).expect(201);
      await request(server).patch(`/complaints/${id}/start`).set('Authorization', worker).send({}).expect(200);
      await resolveWithProof(id, worker);
      await verifyResolution(id, authority);
      await request(server).post(`/complaints/${id}/review`).set('Authorization', resident).send(reviewBody(5)).expect(201);
    };
    await resolveAndReview(complaintA, bearer(RoleName.CommunityAdmin), bearer(RoleName.MaintenanceWorker), bearer(RoleName.Resident), '50000000-0000-4000-8000-000000000001');
    await resolveAndReview(complaintB, `Bearer ${adminB}`, workerB, residentB, '50000000-0000-4000-8000-000000000005');
    await request(server).get(`/complaints/${complaintA}/review`).set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    await request(server).get(`/complaints/${complaintB}/review`).set('Authorization', bearer(RoleName.SuperAdmin)).expect(200);
    await request(server).get(`/complaints/${complaintB}/review`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(403);
    await request(server).get(`/complaints/${complaintA}/review`).set('Authorization', `Bearer ${adminB}`).expect(403);
  });

  it('authenticates each development account with a JWT and server-controlled role', async () => {
    const accounts = [
      [
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'superadmin@urbanity.local',
        'superadmin-dev',
        RoleName.SuperAdmin,
      ],
      [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'community.admin@urbanity.local',
        'community-admin-dev',
        RoleName.CommunityAdmin,
      ],
      [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'tower.representative@urbanity.local',
        'tower-representative-dev',
        RoleName.TowerRepresentative,
      ],
      [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        'resident@urbanity.local',
        'resident-dev',
        RoleName.Resident,
      ],
      [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
        'maintenance.worker@urbanity.local',
        'maintenance-worker-dev',
        RoleName.MaintenanceWorker,
      ],
    ] as const;
    const jwtService = app.get(JwtService);

    for (const [id, email, password, role] of accounts) {
      await request(server)
        .post('/auth/login')
        .send({ email, password })
        .expect(201)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            success: true,
            data: { user: { id, email, role } },
          });
          expect(body.data.user.passwordHash).toBeUndefined();
          expect(body.data.accessToken).toEqual(expect.any(String));

          const payload = jwtService.verify(body.data.accessToken) as {
            sub: string;
            role: RoleName;
            email: string;
            exp: number;
          };

          expect(payload).toMatchObject({ sub: id, role, email });
          expect(payload.exp).toEqual(expect.any(Number));
        });
    }

    await request(server)
      .post('/auth/login')
      .send({
        email: 'resident@urbanity.local',
        password: 'resident-dev',
        role: RoleName.CommunityAdmin,
      })
      .expect(400);

    await request(server)
      .post('/auth/login')
      .send({ email: 'resident@urbanity.local', password: 'incorrect-password' })
      .expect(401);

    await request(server)
      .post('/auth/login')
      .send({ email: 'unknown@urbanity.local', password: 'incorrect-password' })
      .expect(401);
  });

  it('stores password hashes and never returns them through user APIs', async () => {
    const seededResident = SEEDED_USERS.find(
      (user) => user.email === 'resident@urbanity.local',
    ) as User;

    expect(seededResident.passwordHash).not.toBe('resident-dev');
    expect(seededResident.passwordHash).toMatch(/^\$2[aby]\$/);

    const createdUser = await request(server)
      .post('/users')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({
        name: 'Hashed User',
        email: 'hashed.user@urbanity.local',
        password: 'hashed-user-dev',
        role: RoleName.Resident,
        apartmentId: '40000000-0000-4000-8000-000000000011',
      })
      .expect(201);

    expect(createdUser.body.data.passwordHash).toBeUndefined();

    await request(server)
      .post('/auth/login')
      .send({ email: 'hashed.user@urbanity.local', password: 'hashed-user-dev' })
      .expect(201);

    await request(server)
      .get('/users')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ email: 'resident@urbanity.local' }),
          ]),
        );
        expect(JSON.stringify(body.data)).not.toContain('passwordHash');
      });

    await request(server)
      .get('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.passwordHash).toBeUndefined();
      });
  });

  it('restricts global dashboards, reports, and the user directory to community admins', async () => {
    const adminOnlyPaths = [
      '/dashboard/summary',
      '/reports/overview',
      '/users',
    ];
    const retiredPaths = [
      '/assignments',
      '/complaint-updates',
      '/supports',
      '/feedback',
    ];

    for (const path of adminOnlyPaths) {
      await request(server)
        .get(path)
        .set('Authorization', bearer(RoleName.Resident))
        .expect(403);
    }

    await request(server)
      .get('/dashboard/summary')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200);
    await request(server)
      .get('/reports/overview')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200);
    await request(server)
      .get('/users')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200);
    for (const path of retiredPaths) {
      await request(server)
        .get(path)
        .set('Authorization', bearer(RoleName.CommunityAdmin))
        .expect(404);
    }
  });

  it('derives hierarchy and worker access from the authenticated user identity', async () => {
    const residentTwoToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'resident.two@urbanity.local', RoleName.Resident);
    await request(server)
      .get('/users/me/hierarchy')
      .set('Authorization', bearer(RoleName.Resident))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.user.id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2');
        expect(body.data.tower.id).toBe('20000000-0000-4000-8000-000000000001');
      });

    await request(server)
      .get('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4/resident-hierarchy')
      .set('Authorization', bearer(RoleName.Resident))
      .expect(403);
    await request(server)
      .get('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-hierarchy')
      .set('Authorization', residentTwoToken)
      .expect(403);
    await request(server)
      .get('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-hierarchy')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200);
    await request(server)
      .get('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-hierarchy')
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .expect(200);

    await request(server)
      .patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-apartment')
      .set('Authorization', bearer(RoleName.Resident))
      .send({ apartmentId: '40000000-0000-4000-8000-000000000041' })
      .expect(403);
    await request(server)
      .patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4')
      .set('Authorization', bearer(RoleName.Resident))
      .send({ role: RoleName.CommunityAdmin })
      .expect(403);

    await request(server)
      .get('/users/me/hierarchy')
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.tower.id).toBe('20000000-0000-4000-8000-000000000001');
      });
    await request(server)
      .patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/representative-tower')
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ towerId: '20000000-0000-4000-8000-000000000002' })
      .expect(403);
    await request(server)
      .patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-apartment')
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ apartmentId: '40000000-0000-4000-8000-000000000041' })
      .expect(403);

    await request(server)
      .get('/workforce/workers/me')
      .set('Authorization', bearer(RoleName.MaintenanceWorker))
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.userId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3');
      });
    await request(server)
      .get('/workforce/workers/50000000-0000-4000-8000-000000000002')
      .set('Authorization', bearer(RoleName.MaintenanceWorker))
      .expect(403);
    await request(server)
      .patch('/workforce/workers/50000000-0000-4000-8000-000000000001')
      .set('Authorization', bearer(RoleName.MaintenanceWorker))
      .send({ specialization: 'ELECTRICAL' })
      .expect(403);
  });

  it('creates and validates the community hierarchy', async () => {
    const admin = RoleName.SuperAdmin;
    const community = await request(server)
      .post('/communities')
      .set('Authorization', bearer(admin))
      .send({
        name: 'Test Community',
        address: 'Test Address',
        adminName: 'Test Community Admin',
        adminEmail: 'test.community.admin@urbanity.local',
        adminPassword: 'test-community-admin-dev',
        contractedTowers: 5,
        contractedApartments: 10,
      })
      .expect(201);
    const communityId = community.body.data.community.id;
    const communityAdmin = await request(server)
      .post('/auth/login')
      .send({ email: 'test.community.admin@urbanity.local', password: 'test-community-admin-dev' })
      .expect(201);
    await request(server)
      .post('/subscriptions/me/mock-payment')
      .set('Authorization', `Bearer ${communityAdmin.body.data.accessToken}`)
      .send({})
      .expect(201);

    await request(server).get(`/communities/${communityId}`).set('Authorization', bearer(RoleName.Resident)).expect(403);

    const tower = await request(server)
      .post('/towers')
      .set('Authorization', bearer(admin))
      .send({ communityId, name: 'Test Tower', code: 'T' })
      .expect(201);
    await request(server).post('/towers').set('Authorization', bearer(admin)).send({ communityId, name: 'Duplicate Tower', code: 'T' }).expect(400);
    await request(server).post('/towers').set('Authorization', bearer(admin)).send({ communityId: '99999999-9999-4999-8999-999999999999', name: 'Invalid Tower', code: 'X' }).expect(404);

    const floor = await request(server).post('/floors').set('Authorization', bearer(admin)).send({ towerId: tower.body.data.id, floorNumber: 1, label: 'Floor 1' }).expect(201);
    await request(server).post('/floors').set('Authorization', bearer(admin)).send({ towerId: tower.body.data.id, floorNumber: 1, label: 'Duplicate floor' }).expect(400);
    await request(server).post('/floors').set('Authorization', bearer(admin)).send({ towerId: '99999999-9999-4999-8999-999999999999', floorNumber: 1, label: 'Invalid floor' }).expect(404);

    const apartment = await request(server).post('/apartments').set('Authorization', bearer(admin)).send({ floorId: floor.body.data.id, apartmentNumber: 'T-101', label: 'T-101' }).expect(201);
    await request(server).post('/apartments').set('Authorization', bearer(admin)).send({ floorId: floor.body.data.id, apartmentNumber: 'T-101', label: 'Duplicate apartment' }).expect(400);
    await request(server).post('/apartments').set('Authorization', bearer(admin)).send({ floorId: '99999999-9999-4999-8999-999999999999', apartmentNumber: 'X-101', label: 'Invalid apartment' }).expect(404);

    await request(server).patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-apartment').set('Authorization', bearer(admin)).send({ apartmentId: apartment.body.data.id }).expect(200);
    await request(server).patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3/resident-apartment').set('Authorization', bearer(admin)).send({ apartmentId: apartment.body.data.id }).expect(400);
    await request(server).patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1/representative-tower').set('Authorization', bearer(admin)).send({ towerId: tower.body.data.id }).expect(200);
    await request(server).patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/representative-tower').set('Authorization', bearer(admin)).send({ towerId: tower.body.data.id }).expect(400);

    await request(server).get('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/resident-hierarchy').set('Authorization', bearer(RoleName.Resident)).expect(200).expect(({ body }) => {
      expect(body.data).toMatchObject({ apartment: { id: apartment.body.data.id }, floor: { id: floor.body.data.id }, tower: { id: tower.body.data.id }, community: { id: communityId } });
    });
  });

  it('manages a shared maintenance workforce without tower associations', async () => {
    const admin = RoleName.CommunityAdmin;
    const workers = await request(server).get('/workforce/workers').set('Authorization', bearer(RoleName.TowerRepresentative)).expect(200);
    expect(workers.body.data).toHaveLength(4);
    expect(workers.body.data.every((worker: { towerId?: string }) => worker.towerId === undefined)).toBe(true);

    await request(server).get('/workforce/workers').set('Authorization', bearer(RoleName.Resident)).expect(403);
    await request(server).post('/workforce/workers').set('Authorization', bearer(RoleName.TowerRepresentative)).send({ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', specialization: 'PLUMBING' }).expect(403);
    await request(server).post('/workforce/workers').set('Authorization', bearer(admin)).send({ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', specialization: 'PLUMBING' }).expect(400);
    await request(server).post('/workforce/workers').set('Authorization', bearer(admin)).send({ userId: '99999999-9999-4999-8999-999999999999', specialization: 'PLUMBING' }).expect(404);
    await request(server).post('/workforce/workers').set('Authorization', bearer(admin)).send({ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', specialization: 'PLUMBING' }).expect(400);
    await request(server).post('/workforce/workers').set('Authorization', bearer(admin)).send({ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', specialization: 'INVALID' }).expect(400);

    for (const status of ['AVAILABLE', 'ON_LEAVE', 'INACTIVE']) {
      await request(server).patch('/workforce/workers/50000000-0000-4000-8000-000000000001').set('Authorization', bearer(admin)).send({ status }).expect(200);
    }
    await request(server).patch('/workforce/workers/50000000-0000-4000-8000-000000000001').set('Authorization', bearer(admin)).send({ status: 'BUSY' }).expect(400);
    await request(server).patch('/workforce/workers/50000000-0000-4000-8000-000000000001').set('Authorization', bearer(admin)).send({ status: 'INVALID', rating: 5, completedWorkCount: 9 }).expect(400);
    const worker = await request(server).get('/workforce/workers/50000000-0000-4000-8000-000000000001').set('Authorization', bearer(admin)).expect(200);
    expect(worker.body.data).toMatchObject({ rating: 0, completedWorkCount: 0, workHistory: [] });
  });

  it('creates apartment, tower, and community complaints from derived resident locations', async () => {
    const resident = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    const residentTwo = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
    const residentTwoToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'resident.two@urbanity.local', RoleName.Resident);
    for (const [type, residentId, token] of [['APARTMENT', resident, bearer(RoleName.Resident)], ['TOWER', residentTwo, residentTwoToken], ['COMMUNITY', resident, bearer(RoleName.Resident)]] as const) {
      const response = await request(server).post('/complaints').set('Authorization', token).send({ type, title: `${type} issue`, description: 'A valid complaint description.', requiredWorkType: 'PLUMBING' }).expect(201);
      const expectedAuthority = type === 'COMMUNITY'
        ? { responsibleRole: RoleName.CommunityAdmin, responsibleUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }
        : type === 'APARTMENT'
          ? { responsibleRole: RoleName.TowerRepresentative, responsibleUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' }
          : { responsibleRole: RoleName.TowerRepresentative, responsibleUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8' };
      expect(response.body.data).toMatchObject({ residentId, type, status: 'SUBMITTED', attachments: [], ...expectedAuthority });
    }
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ type: 'APARTMENT', title: '', description: 'Description', requiredWorkType: 'PLUMBING' }).expect(400);
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ type: 'INVALID', title: 'Invalid type', description: 'Description', requiredWorkType: 'PLUMBING' }).expect(400);
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ residentId: '99999999-9999-4999-8999-999999999999', type: 'APARTMENT', title: 'Unknown resident', description: 'Description', requiredWorkType: 'PLUMBING' }).expect(400);
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', type: 'APARTMENT', title: 'Worker complaint', description: 'Description', requiredWorkType: 'PLUMBING' }).expect(400);
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ type: 'APARTMENT', title: 'Mismatched apartment', description: 'Description', apartmentId: '40000000-0000-4000-8000-000000000041', requiredWorkType: 'PLUMBING' }).expect(400);
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ type: 'APARTMENT', title: 'Invalid status', description: 'Description', status: 'RESOLVED', requiredWorkType: 'PLUMBING' }).expect(400);
    await request(server).get('/complaints').set('Authorization', bearer(RoleName.TowerRepresentative)).expect(200);
  });

  it('enforces resident and authority complaint ownership from JWT identity', async () => {
    const residentAComplaint = '60000000-0000-4000-8000-000000000001';
    const residentBComplaint = '60000000-0000-4000-8000-000000000002';
    const residentTwoToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'resident.two@urbanity.local', RoleName.Resident);
    const towerBRepresentativeToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', 'tower.b.representative@urbanity.local', RoleName.TowerRepresentative);

    const residentAList = await request(server)
      .get('/complaints')
      .set('Authorization', bearer(RoleName.Resident))
      .expect(200);
    expect(residentAList.body.data.every((complaint: { residentId: string }) => complaint.residentId === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')).toBe(true);

    await request(server)
      .get(`/complaints/${residentBComplaint}`)
      .set('Authorization', bearer(RoleName.Resident))
      .expect(403);
    await request(server)
      .patch(`/complaints/${residentBComplaint}`)
      .set('Authorization', bearer(RoleName.Resident))
      .send({ title: 'Spoofed update' })
      .expect(403);
    await request(server)
      .patch(`/complaints/${residentAComplaint}`)
      .set('Authorization', bearer(RoleName.Resident))
      .send({ title: 'Resident-owned update' })
      .expect(200);
    await request(server)
      .post('/complaints')
      .set('Authorization', bearer(RoleName.Resident))
      .send({ residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', type: 'APARTMENT', title: 'Spoofed resident', description: 'Rejected identity field.', requiredWorkType: 'PLUMBING' })
      .expect(400);

    await request(server)
      .get(`/complaints/${residentAComplaint}`)
      .set('Authorization', residentTwoToken)
      .expect(403);
    await request(server)
      .get(`/complaints/${residentBComplaint}`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .expect(403);
    await request(server)
      .patch(`/complaints/${residentBComplaint}/status`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ status: 'UNDER_REVIEW' })
      .expect(403);
    await request(server)
      .get(`/complaints/${residentBComplaint}`)
      .set('Authorization', towerBRepresentativeToken)
      .expect(200);
    await request(server)
      .get('/complaints')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200)
      .expect(({ body }) => expect(body.data).toHaveLength(3));
  });

  it('derives worker complaint actions from the assigned worker profile', async () => {
    const complaintId = '60000000-0000-4000-8000-000000000001';
    const workerA = '50000000-0000-4000-8000-000000000001';
    const workerBToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
      'worker.electrical@urbanity.local',
      RoleName.MaintenanceWorker,
    );

    await request(server)
      .patch(`/complaints/${complaintId}/status`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    await request(server)
      .post(`/complaints/${complaintId}/assign`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ workerId: workerA })
      .expect(201);

    await request(server)
      .get(`/complaints/${complaintId}`)
      .set('Authorization', workerBToken)
      .expect(403);
    await request(server)
      .patch(`/complaints/${complaintId}/start`)
      .set('Authorization', workerBToken)
      .send({})
      .expect(403);
    await request(server)
      .patch(`/complaints/${complaintId}/start`)
      .set('Authorization', bearer(RoleName.MaintenanceWorker))
      .send({ workerId: '50000000-0000-4000-8000-000000000002' })
      .expect(400);
    await request(server)
      .patch(`/complaints/${complaintId}/start`)
      .set('Authorization', bearer(RoleName.MaintenanceWorker))
      .send({})
      .expect(200);
    await request(server)
      .patch(`/complaints/${complaintId}/resolve`)
      .set('Authorization', workerBToken)
      .send(resolutionBody('90000000-0000-4000-8000-000000000001'))
      .expect(403);
  });

  it('limits worker selection to the responsible authority and eligible worker state', async () => {
    const towerAComplaint = '60000000-0000-4000-8000-000000000001';
    const towerBComplaint = '60000000-0000-4000-8000-000000000002';
    const towerBRepresentativeToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8',
      'tower.b.representative@urbanity.local',
      RoleName.TowerRepresentative,
    );

    await request(server)
      .get(`/complaints/${towerBComplaint}/eligible-workers`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .expect(403);
    await request(server)
      .post(`/complaints/${towerBComplaint}/assign`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ workerId: '50000000-0000-4000-8000-000000000003' })
      .expect(403);
    await request(server)
      .get(`/complaints/${towerAComplaint}/eligible-workers`)
      .set('Authorization', bearer(RoleName.Resident))
      .expect(403);

    await request(server)
      .patch(`/complaints/${towerAComplaint}/status`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    await request(server)
      .post(`/complaints/${towerAComplaint}/assign`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ workerId: '50000000-0000-4000-8000-000000000002' })
      .expect(400);

    const hvacComplaint = await request(server)
      .post('/complaints')
      .set('Authorization', bearer(RoleName.Resident))
      .send({
        type: 'APARTMENT',
        title: 'HVAC maintenance request',
        description: 'The apartment air conditioner requires service.',
        requiredWorkType: 'HVAC',
      })
      .expect(201);
    await request(server)
      .patch(`/complaints/${hvacComplaint.body.data.id}/status`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    await request(server)
      .post(`/complaints/${hvacComplaint.body.data.id}/assign`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ workerId: '50000000-0000-4000-8000-000000000004' })
      .expect(400);
    await request(server)
      .patch('/workforce/workers/50000000-0000-4000-8000-000000000004')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send({ status: 'INACTIVE' })
      .expect(200);
    await request(server)
      .post(`/complaints/${hvacComplaint.body.data.id}/assign`)
      .set('Authorization', bearer(RoleName.TowerRepresentative))
      .send({ workerId: '50000000-0000-4000-8000-000000000004' })
      .expect(400);
    await request(server)
      .get(`/complaints/${towerBComplaint}/eligible-workers`)
      .set('Authorization', towerBRepresentativeToken)
      .expect(200);
  });

  it('enforces resident-owned reviews and derives worker performance from the completed assignment', async () => {
    const complaintId = '60000000-0000-4000-8000-000000000002';
    const residentTwoToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
      'resident.two@urbanity.local',
      RoleName.Resident,
    );
    const towerBRepresentativeToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8',
      'tower.b.representative@urbanity.local',
      RoleName.TowerRepresentative,
    );
    const workerCToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
      'worker.general@urbanity.local',
      RoleName.MaintenanceWorker,
    );

    await request(server)
      .patch(`/complaints/${complaintId}/status`)
      .set('Authorization', towerBRepresentativeToken)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    await request(server)
      .post(`/complaints/${complaintId}/assign`)
      .set('Authorization', towerBRepresentativeToken)
      .send({ workerId: '50000000-0000-4000-8000-000000000003' })
      .expect(201);
    await request(server)
      .patch(`/complaints/${complaintId}/start`)
      .set('Authorization', workerCToken)
      .send({})
      .expect(200);
    await resolveWithProof(complaintId, workerCToken);
    await verifyResolution(complaintId, towerBRepresentativeToken);

    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', bearer(RoleName.Resident))
      .send(reviewBody(5))
      .expect(403);
    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', residentTwoToken)
      .send({ ...reviewBody(4), residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' })
      .expect(400);
    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', residentTwoToken)
      .send({ ...reviewBody(4), workerId: '50000000-0000-4000-8000-000000000001' })
      .expect(400);
    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', residentTwoToken)
      .send({ ...reviewBody(4), complaintId: '60000000-0000-4000-8000-000000000001' })
      .expect(400);
    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .send(reviewBody(4))
      .expect(403);

    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', residentTwoToken)
      .send(reviewBody(4, 'Lift service was completed carefully.'))
      .expect(201)
      .expect(({ body }) => expect(body.data.status).toBe('REVIEWED'));
    await request(server)
      .post(`/complaints/${complaintId}/review`)
      .set('Authorization', residentTwoToken)
      .send(reviewBody(4))
      .expect(400);

    await request(server)
      .get(`/complaints/${complaintId}/review`)
      .set('Authorization', bearer(RoleName.Resident))
      .expect(403);
    await request(server)
      .get(`/complaints/${complaintId}/review`)
      .set('Authorization', workerCToken)
      .expect(200);
    await request(server)
      .get(`/complaints/${complaintId}/review`)
      .set('Authorization', residentTwoToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          complaintId,
          residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
          workerId: '50000000-0000-4000-8000-000000000003',
          rating: 4,
        });
      });
    const worker = await request(server)
      .get('/workforce/workers/50000000-0000-4000-8000-000000000003')
      .set('Authorization', bearer(RoleName.CommunityAdmin))
      .expect(200);
    expect(worker.body.data).toMatchObject({
      rating: 4.5,
      completedWorkCount: 1,
      workHistory: [complaintId],
    });
  });

  it('routes complaints server-side and fails when required authorities are unavailable', async () => {
    const admin = RoleName.CommunityAdmin;
    const residentA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
    const residentB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4';
    const residentTwoToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'resident.two@urbanity.local', RoleName.Resident);
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ residentId: residentA, type: 'APARTMENT', title: 'Client authority', description: 'Authority must be derived.', responsibleUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', requiredWorkType: 'PLUMBING' }).expect(400);

    await request(server).patch('/users/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8/representative-tower').set('Authorization', bearer(admin)).send({ towerId: '20000000-0000-4000-8000-000000000001' }).expect(200);
    await request(server).post('/complaints').set('Authorization', residentTwoToken).send({ type: 'TOWER', title: 'Unrouted tower', description: 'Tower B has no representative.', requiredWorkType: 'LIFT_MAINTENANCE' }).expect(400).expect(({ body }) => expect(body.error.message).toContain('No Tower Representative'));

    app.get<CrudService<User, unknown, unknown>>(serviceToken('users')).delete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await request(server).post('/complaints').set('Authorization', bearer(RoleName.Resident)).send({ type: 'COMMUNITY', title: 'Unrouted community', description: 'No community admin remains.', requiredWorkType: 'PLUMBING' }).expect(400).expect(({ body }) => expect(body.error.message).toContain('No Community Admin'));
  });

  it('enforces the complaint lifecycle and records append-only status history', async () => {
    const id = '60000000-0000-4000-8000-000000000001';
    const representative = RoleName.TowerRepresentative;
    await request(server).patch(`/complaints/${id}`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ status: 'CLOSED' }).expect(400);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'RESOLVED' }).expect(400);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(RoleName.Resident)).send({ status: 'UNDER_REVIEW' }).expect(403);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'UNDER_REVIEW' }).expect(200);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'ASSIGNED' }).expect(400);
    await request(server).post(`/complaints/${id}/assign`).set('Authorization', bearer(representative)).send({ workerId: '50000000-0000-4000-8000-000000000001' }).expect(201);
    await request(server).patch(`/complaints/${id}/start`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send({}).expect(200);
    await resolveWithProof(id, bearer(RoleName.MaintenanceWorker));
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'REVIEWED' }).expect(400);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(RoleName.Resident)).send({ status: 'REVIEWED' }).expect(400);
    await verifyResolution(id, bearer(representative));
    await request(server).post(`/complaints/${id}/review`).set('Authorization', bearer(RoleName.Resident)).send(reviewBody(5, 'Quick and careful repair.')).expect(201);
    const closed = await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'CLOSED' }).expect(200);
    expect(closed.body.data.statusHistory.map((entry: { status: string }) => entry.status)).toEqual(['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'RESOLVED', 'REVIEWED', 'CLOSED']);
    expect(closed.body.data.statusHistory.every((entry: { changedAt?: string }) => Boolean(entry.changedAt))).toBe(true);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'CLOSED' }).expect(400);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'SUBMITTED' }).expect(400);
    await request(server).patch(`/complaints/${id}/status`).set('Authorization', bearer(representative)).send({ status: 'NOT_A_STATUS' }).expect(400);
  });

  it('assigns shared workers, tracks work progress, and resolves work', async () => {
    const complaintId = '60000000-0000-4000-8000-000000000001';
    const workerId = '50000000-0000-4000-8000-000000000001';
    const residentTwoToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'resident.two@urbanity.local', RoleName.Resident);
    const towerBRepresentativeToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', 'tower.b.representative@urbanity.local', RoleName.TowerRepresentative);
    await request(server).patch(`/complaints/${complaintId}/status`).set('Authorization', bearer(RoleName.TowerRepresentative)).send({ status: 'UNDER_REVIEW' }).expect(200);
    const eligible = await request(server).get(`/complaints/${complaintId}/eligible-workers`).set('Authorization', bearer(RoleName.TowerRepresentative)).expect(200);
    expect(eligible.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: workerId, specialization: 'PLUMBING', status: 'AVAILABLE' })]));
    await request(server).post(`/complaints/${complaintId}/assign`).set('Authorization', bearer(RoleName.Resident)).send({ workerId }).expect(403);
    const assigned = await request(server).post(`/complaints/${complaintId}/assign`).set('Authorization', bearer(RoleName.TowerRepresentative)).send({ workerId }).expect(201);
    expect(assigned.body.data).toMatchObject({ status: 'ASSIGNED', assignedWorkerId: workerId });
    const busyWorker = await request(server).get(`/workforce/workers/${workerId}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    expect(busyWorker.body.data.status).toBe('BUSY');
    await request(server).patch(`/complaints/${complaintId}/status`).set('Authorization', bearer(RoleName.TowerRepresentative)).send({ status: 'IN_PROGRESS' }).expect(400);
    await request(server).patch(`/complaints/${complaintId}/start`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send({ workerId: '50000000-0000-4000-8000-000000000002' }).expect(400);
    await request(server).patch(`/complaints/${complaintId}/start`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send({}).expect(200);
    const resolved = await resolveWithProof(complaintId, bearer(RoleName.MaintenanceWorker));
    expect(resolved.body.data.status).toBe('PENDING_VERIFICATION');
    await verifyResolution(complaintId, bearer(RoleName.TowerRepresentative));
    const availableWorker = await request(server).get(`/workforce/workers/${workerId}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    expect(availableWorker.body.data).toMatchObject({ status: 'AVAILABLE', workHistory: [complaintId], completedWorkCount: 0, rating: 0 });

    const towerComplaintId = '60000000-0000-4000-8000-000000000002';
    await request(server).patch(`/complaints/${towerComplaintId}/status`).set('Authorization', towerBRepresentativeToken).send({ status: 'UNDER_REVIEW' }).expect(200);
    const liftEligible = await request(server).get(`/complaints/${towerComplaintId}/eligible-workers`).set('Authorization', towerBRepresentativeToken).expect(200);
    expect(liftEligible.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: '50000000-0000-4000-8000-000000000003', specialization: 'LIFT_MAINTENANCE' })]));

    const sharedTowerB = await request(server).post('/complaints').set('Authorization', residentTwoToken).send({ type: 'TOWER', title: 'Tower B plumbing issue', description: 'A plumbing issue in Tower B.', requiredWorkType: 'PLUMBING' }).expect(201);
    await request(server).patch(`/complaints/${sharedTowerB.body.data.id}/status`).set('Authorization', towerBRepresentativeToken).send({ status: 'UNDER_REVIEW' }).expect(200);
    await request(server).post(`/complaints/${sharedTowerB.body.data.id}/assign`).set('Authorization', towerBRepresentativeToken).send({ workerId }).expect(201);
  });

  it('creates one review per resolved complaint and aggregates worker performance', async () => {
    const workerId = '50000000-0000-4000-8000-000000000001';
    const firstId = '60000000-0000-4000-8000-000000000001';
    const residentTwoToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'resident.two@urbanity.local', RoleName.Resident);
    const towerBRepresentativeToken = tokenFor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', 'tower.b.representative@urbanity.local', RoleName.TowerRepresentative);
    const resolveAndReview = async (id: string, rating: number, authorityToken = bearer(RoleName.TowerRepresentative), residentToken = bearer(RoleName.Resident)) => {
      await request(server).patch(`/complaints/${id}/status`).set('Authorization', authorityToken).send({ status: 'UNDER_REVIEW' }).expect(200);
      await request(server).post(`/complaints/${id}/assign`).set('Authorization', authorityToken).send({ workerId }).expect(201);
      await request(server).patch(`/complaints/${id}/start`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send({}).expect(200);
      await resolveWithProof(id, bearer(RoleName.MaintenanceWorker));
      await verifyResolution(id, authorityToken);
      return request(server).post(`/complaints/${id}/review`).set('Authorization', residentToken).send(reviewBody(rating, 'Completed successfully.')).expect(201);
    };
    await request(server).post(`/complaints/${firstId}/review`).set('Authorization', bearer(RoleName.Resident)).send(reviewBody(5)).expect(400);
    await resolveAndReview(firstId, 5);
    const review = await request(server).get(`/complaints/${firstId}/review`).set('Authorization', bearer(RoleName.Resident)).expect(200);
    expect(review.body.data).toMatchObject({ complaintId: firstId, residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', workerId, rating: 5 });
    await request(server).post(`/complaints/${firstId}/review`).set('Authorization', bearer(RoleName.Resident)).send(reviewBody(5)).expect(400);

    const second = await request(server).post('/complaints').set('Authorization', residentTwoToken).send({ type: 'TOWER', title: 'Tower plumbing issue', description: 'Pipe leak in a shared area.', requiredWorkType: 'PLUMBING' }).expect(201);
    await resolveAndReview(second.body.data.id, 3, towerBRepresentativeToken, residentTwoToken);
    const worker = await request(server).get(`/workforce/workers/${workerId}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(200);
    expect(worker.body.data).toMatchObject({ rating: 4.5, completedWorkCount: 2 });
    await request(server).patch(`/workforce/workers/${workerId}`).set('Authorization', bearer(RoleName.CommunityAdmin)).send({ rating: 5, completedWorkCount: 999, workHistory: [] }).expect(400);
    await request(server).post(`/complaints/${second.body.data.id}/review`).set('Authorization', bearer(RoleName.MaintenanceWorker)).send(reviewBody(5)).expect(403);
    await request(server).post(`/complaints/${second.body.data.id}/review`).set('Authorization', bearer(RoleName.Resident)).send(reviewBody(4.5)).expect(400);
  });

  it('stores validated complaint images and serves them through scoped attachment routes', async () => {
    const complaintId = '60000000-0000-4000-8000-000000000001';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const uploaded = await request(server).post(`/complaints/${complaintId}/attachments`).set('Authorization', bearer(RoleName.Resident)).attach('file', png, { filename: '../../photo (1).png', contentType: 'image/png' }).expect(201);
    expect(uploaded.body.data).toMatchObject({ originalName: 'photo (1).png', mimeType: 'image/png' });
    expect(uploaded.body.data).not.toHaveProperty('storedName');
    const attachmentId = uploaded.body.data.id;
    const attachments = await request(server).get(`/complaints/${complaintId}/attachments`).set('Authorization', bearer(RoleName.Resident)).expect(200);
    expect(attachments.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: attachmentId })]));
    await request(server).get(`/complaints/${complaintId}/attachments/${attachmentId}`).set('Authorization', bearer(RoleName.Resident)).expect('Content-Type', /image\/png/).expect(200);
    await request(server).get(`/complaints/60000000-0000-4000-8000-000000000002/attachments/${attachmentId}`).set('Authorization', bearer(RoleName.Resident)).expect(403);
    await request(server).post(`/complaints/${complaintId}/attachments`).set('Authorization', bearer(RoleName.Resident)).attach('file', Buffer.from('not an image'), { filename: 'note.txt', contentType: 'text/plain' }).expect(400);
    await request(server).post(`/complaints/${complaintId}/attachments`).set('Authorization', bearer(RoleName.Resident)).attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(413);
    await request(server).post(`/complaints/${complaintId}/attachments`).set('Authorization', bearer(RoleName.TowerRepresentative)).attach('file', png, { filename: 'role.png', contentType: 'image/png' }).expect(403);
  });

  it('inherits attachment access from the authorized complaint relationship', async () => {
    const complaintA = '60000000-0000-4000-8000-000000000001';
    const complaintB = '60000000-0000-4000-8000-000000000002';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const residentTwoToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
      'resident.two@urbanity.local',
      RoleName.Resident,
    );
    const towerBRepresentativeToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8',
      'tower.b.representative@urbanity.local',
      RoleName.TowerRepresentative,
    );
    const workerBToken = tokenFor(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
      'worker.electrical@urbanity.local',
      RoleName.MaintenanceWorker,
    );

    const uploadedA = await request(server)
      .post(`/complaints/${complaintA}/attachments`)
      .set('Authorization', bearer(RoleName.Resident))
      .attach('file', png, { filename: 'resident-a.png', contentType: 'image/png' })
      .expect(201);
    const attachmentA = uploadedA.body.data.id;
    const uploadedB = await request(server)
      .post(`/complaints/${complaintB}/attachments`)
      .set('Authorization', residentTwoToken)
      .attach('file', png, { filename: 'resident-b.png', contentType: 'image/png' })
      .expect(201);
    const attachmentB = uploadedB.body.data.id;

    await request(server)
      .post(`/complaints/${complaintB}/attachments`)
      .set('Authorization', bearer(RoleName.Resident))
      .attach('file', png, { filename: 'blocked.png', contentType: 'image/png' })
      .expect(403);
    const residentBAttachments = await request(server)
      .get(`/complaints/${complaintB}/attachments`)
      .set('Authorization', residentTwoToken)
      .expect(200);
    expect(residentBAttachments.body.data).toHaveLength(1);

    await request(server).get(`/complaints/${complaintB}/attachments`).set('Authorization', bearer(RoleName.Resident)).expect(403);
    await request(server).get(`/complaints/${complaintB}/attachments/${attachmentB}`).set('Authorization', bearer(RoleName.Resident)).expect(403);
    await request(server).get(`/complaints/${complaintA}/attachments/${attachmentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect(404);

    await request(server).get(`/complaints/${complaintA}/attachments`).set('Authorization', bearer(RoleName.TowerRepresentative)).expect(200);
    await request(server).get(`/complaints/${complaintA}/attachments/${attachmentA}`).set('Authorization', bearer(RoleName.TowerRepresentative)).expect('Content-Type', /image\/png/).expect(200);
    await request(server).get(`/complaints/${complaintB}/attachments`).set('Authorization', bearer(RoleName.TowerRepresentative)).expect(403);
    await request(server).get(`/complaints/${complaintA}/attachments`).set('Authorization', towerBRepresentativeToken).expect(403);
    await request(server).get(`/complaints/${complaintB}/attachments/${attachmentB}`).set('Authorization', towerBRepresentativeToken).expect('Content-Type', /image\/png/).expect(200);
    await request(server).get(`/complaints/${complaintB}/attachments/${attachmentB}`).set('Authorization', bearer(RoleName.CommunityAdmin)).expect('Content-Type', /image\/png/).expect(200);

    await request(server).patch(`/complaints/${complaintA}/status`).set('Authorization', bearer(RoleName.TowerRepresentative)).send({ status: 'UNDER_REVIEW' }).expect(200);
    await request(server).post(`/complaints/${complaintA}/assign`).set('Authorization', bearer(RoleName.TowerRepresentative)).send({ workerId: '50000000-0000-4000-8000-000000000001' }).expect(201);
    await request(server).get(`/complaints/${complaintA}/attachments`).set('Authorization', bearer(RoleName.MaintenanceWorker)).expect(200);
    await request(server).get(`/complaints/${complaintA}/attachments/${attachmentA}`).set('Authorization', bearer(RoleName.MaintenanceWorker)).expect('Content-Type', /image\/png/).expect(200);
    await request(server).get(`/complaints/${complaintA}/attachments`).set('Authorization', workerBToken).expect(403);
    await request(server).post(`/complaints/${complaintA}/attachments`).set('Authorization', bearer(RoleName.MaintenanceWorker)).attach('file', png, { filename: 'worker.png', contentType: 'image/png' }).expect(400);
  });

  afterEach(async () => {
    await app.get(LoggingService).flush();
    await app.close();
    await rm(logDirectory, { recursive: true, force: true });
  });
});
