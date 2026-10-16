import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { SEEDED_USERS } from '../src/data/urbanity.resources';
import { LOG_DIRECTORY } from '../src/common/logging/logging.constants';
import { LoggingService } from '../src/common/logging/logging.service';
import { validationPipe } from '../src/common/pipes/validation.pipe';
import { configureHttpSecurity } from '../src/config/security.config';
import { DEFAULT_COMMUNITY_ADMIN_PASSWORD } from '../src/modules/registrations/registration.constants';
import { RegistrationService } from '../src/modules/registrations/registration.service';

type Application = ReturnType<RegistrationService['status']>;
const data = <T>(r: Response) => (r.body as { data: T }).data;
const cookies = (r: Response) =>
  (r.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);

describe('Public registration and Super Admin onboarding API', () => {
  let app: INestApplication, logs: string;
  const server = () => app.getHttpServer() as App;
  const auth = (email = 'superadmin@urbanity.local') => {
    const user = SEEDED_USERS.find((u) => u.email === email)!;
    return `Bearer ${app.get(JwtService).sign({ sub: user.id })}`;
  };
  const adminPost = (path: string, body: object = {}) =>
    request(server())
      .post(`/registration-administration${path}`)
      .set('Authorization', auth())
      .send(body);
  const dto = () => ({
    requestId: randomUUID(),
    pricingVersion: 2,
    fullName: 'Authorized Person',
    email: `${randomUUID()}@example.test`,
    communityName: 'Proposed Community',
    address: '100 Example Road',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517001',
    country: 'India',
    towers: 2,
    floors: 4,
    apartments: 20,
    authorized: true,
  });
  const configure = async () =>
    request(server())
      .patch('/registration-administration/pricing')
      .set('Authorization', auth())
      .send({
        enabled: true,
        initialPercent: 20,
        paymentInstructions:
          'Transfer to the platform account and supply your bank reference.',
      })
      .expect(200);
  const submit = async () => {
    await configure();
    const body = dto();
    const response = await request(server())
      .post('/community-registrations')
      .send(body)
      .expect(201);
    return {
      body,
      response,
      a: data<Application>(response),
      cookie: cookies(response),
    };
  };
  const initial = async (item: Awaited<ReturnType<typeof submit>>) => {
    const res = await request(server())
      .post(`/community-registrations/${item.a.id}/payments`)
      .set('Cookie', item.cookie)
      .send({
        requestId: randomUUID(),
        amountMinor: item.a.pricing.initialMinor,
        transactionReference: randomUUID(),
      })
      .expect(201);
    const payment = data<Application>(res).payments[0];
    await adminPost(`/${item.a.id}/payments/${payment.id}/review`, {
      decision: 'VERIFIED',
      reason: 'Bank receipt matched',
    }).expect(201);
  };
  beforeEach(async () => {
    logs = await mkdtemp(join(tmpdir(), 'urbanity-registration-'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOG_DIRECTORY)
      .useValue(logs)
      .compile();
    app = module.createNestApplication();
    configureHttpSecurity(app);
    app.useGlobalPipes(validationPipe);
    await app.listen(0, '127.0.0.1');
  });
  afterEach(async () => {
    await app?.get(LoggingService).flush();
    await app?.close();
    await rm(logs, { recursive: true, force: true, maxRetries: 3 });
  });

  it('opens evaluation registration by default and enforces exact Super Admin authorization', async () => {
    expect(
      data<{ enabled: boolean }>(
        await request(server())
          .get('/community-registrations/pricing')
          .expect(200),
      ).enabled,
    ).toBe(true);
    await request(server())
      .post('/community-registrations')
      .send({ ...dto(), pricingVersion: 1 })
      .expect(201);
    await request(server()).get('/registration-administration').expect(401);
    for (const email of [
      'community.admin@urbanity.local',
      'resident@urbanity.local',
      'maintenance.worker@urbanity.local',
      'tower.representative@urbanity.local',
    ]) {
      const user = SEEDED_USERS.find((u) => u.email === email);
      if (user)
        await request(server())
          .get('/registration-administration')
          .set('Authorization', auth(email))
          .expect(403);
    }
    await configure();
    const response = await request(server())
      .post('/community-registrations/quote')
      .send({ towers: 2, apartments: 20 })
      .expect(201);
    expect(
      data<{ totalMinor: number; initialMinor: number }>(response),
    ).toMatchObject({ totalMinor: 220000, initialMinor: 44000 });
  });
  it('rejects missing required fields and phone strings without digits', async () => {
    await configure();
    await request(server())
      .post('/community-registrations')
      .send({ requestId: randomUUID() })
      .expect(400);
    await request(server())
      .post('/community-registrations')
      .send({ ...dto(), phone: '-------' })
      .expect(400);
    await request(server())
      .post('/registration-administration/unknown/review')
      .set('Authorization', auth('community.admin@urbanity.local'))
      .send({
        decision: 'APPROVED',
        reason: 'Unauthorized approval',
        confirmedAuthority: true,
      })
      .expect(403);
  });
  it('validates applicant input and rejects role, price, identity and state injection', async () => {
    await configure();
    for (const changes of [
      { role: 'SUPER_ADMIN' },
      { totalMinor: 1 },
      { accountState: 'ACTIVE' },
      { communityId: randomUUID() },
      { authorized: false },
      { towers: 0 },
      { email: 'invalid' },
      { phone: 'letters' },
      { floors: 1 },
      { communityName: '   ' },
    ]) {
      await request(server())
        .post('/community-registrations')
        .send({ ...dto(), ...changes })
        .expect(400);
    }
    await request(server())
      .post('/community-registrations')
      .type('form')
      .send({ fullName: 'CSRF request' })
      .expect(415);
  });
  it('protects private lookup, issues HttpOnly cookies, handles retries and avoids secret logging', async () => {
    const item = await submit(),
      id = item.a.id;
    const rawCookies = item.response.headers[
      'set-cookie'
    ] as unknown as string[];
    expect(rawCookies[0]).toMatch(/HttpOnly/);
    expect(rawCookies[0]).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(item.response.body)).not.toMatch(
      /sessionHash|passwordHash|secret|setupHash/,
    );
    await request(server())
      .get(`/community-registrations/${id}/status`)
      .expect(401);
    await request(server())
      .get(`/community-registrations/${randomUUID()}/status`)
      .set('Cookie', item.cookie)
      .expect(401);
    const status = await request(server())
      .get(`/community-registrations/${id}/status`)
      .set('Cookie', item.cookie)
      .expect(200);
    expect(status.headers['cache-control']).toContain('no-store');
    const retry = await request(server())
      .post('/community-registrations')
      .set('Cookie', item.cookie)
      .send(item.body)
      .expect(201);
    expect(data<Application>(retry).id).toBe(id);
    await request(server())
      .post('/community-registrations')
      .send({ ...item.body, requestId: randomUUID() })
      .expect(409);
    await app.get(LoggingService).flush();
    const contents = (
      await Promise.all(
        (await readdir(logs))
          .filter((n) => n.endsWith('.log'))
          .map((n) => readFile(join(logs, n), 'utf8')),
      )
    ).join('');
    expect(contents).not.toContain(item.cookie[0].split('=')[1]);
  });
  it('allows login on approval and preserves scope and generic-user protections', async () => {
    const item = await submit(),
      id = item.a.id;
    await adminPost(`/${id}/review`, {
      decision: 'APPROVED',
      reason: 'Authority checked',
      confirmedAuthority: true,
    }).expect(400);
    await initial(item);
    const approved = data<Application>(
      await adminPost(`/${id}/review`, {
        decision: 'APPROVED',
        reason: 'Identity and authority checked',
        confirmedAuthority: true,
      }).expect(201),
    );
    const repeated = data<Application>(
      await adminPost(`/${id}/review`, {
        decision: 'APPROVED',
        reason: 'Retry approval',
        confirmedAuthority: true,
      }).expect(201),
    );
    expect(repeated.adminId).toBe(approved.adminId);
    const forged = `Bearer ${app.get(JwtService).sign({ sub: approved.adminId })}`;
    await request(server())
      .get('/auth/me')
      .set('Authorization', forged)
      .expect(200);
    await request(server())
      .post('/subscriptions/me/mock-payment')
      .set('Authorization', forged)
      .send({})
      .expect(403);
    await request(server())
      .post('/towers')
      .set('Authorization', auth())
      .send({ communityId: approved.communityId, name: 'Early', code: 'EARLY' })
      .expect(201);
    await request(server())
      .patch(`/users/${approved.adminId}`)
      .set('Authorization', auth())
      .send({ password: 'bypass-password' })
      .expect(403);
    await request(server())
      .patch(`/users/${approved.adminId}`)
      .set('Authorization', auth())
      .send({ role: 'SUPER_ADMIN' })
      .expect(403);
    await request(server())
      .delete(`/users/${approved.adminId}`)
      .set('Authorization', auth())
      .expect(403);
    await request(server())
      .delete(`/communities/${approved.communityId}`)
      .set('Authorization', auth())
      .expect(403);
    await request(server())
      .post(`/community-registrations/${id}/credential-setup`)
      .set('Cookie', item.cookie)
      .send({ password: 'secure-password' })
      .expect(401);
    await request(server())
      .post(`/community-registrations/${id}/setup-session`)
      .set('Cookie', item.cookie)
      .send({})
      .expect(409);
    await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      })
      .expect(201);
    await adminPost(`/${id}/activate`).expect(201);
    const payment = data<Application>(
      await request(server())
        .post(`/community-registrations/${id}/payments`)
        .set('Cookie', item.cookie)
        .send({
          requestId: randomUUID(),
          amountMinor: approved.outstandingMinor,
          transactionReference: 'REMAINING-TRANSFER-1',
        })
        .expect(201),
    ).payments.at(-1)!;
    await adminPost(`/${id}/activate`).expect(201);
    await adminPost(`/${id}/payments/${payment.id}/review`, {
      decision: 'VERIFIED',
      reason: 'Full balance confirmed in bank',
    }).expect(201);
    await adminPost(`/${id}/payments/${payment.id}/review`, {
      decision: 'VERIFIED',
      reason: 'Verification retry',
    }).expect(201);
    const activated = data<Application>(
      await adminPost(`/${id}/activate`).expect(201),
    );
    expect(activated.status).toBe('ACTIVE');
    expect(activated.verifiedMinor).toBe(220000);
    expect(activated.outstandingMinor).toBe(0);
    await adminPost(`/${id}/activate`).expect(201);
    const login = await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      })
      .expect(201);
    const token = `Bearer ${data<{ accessToken: string }>(login).accessToken}`;
    await request(server())
      .post('/towers')
      .set('Authorization', token)
      .send({
        communityId: approved.communityId,
        name: 'First tower',
        code: 'T1',
      })
      .expect(201);
    await request(server())
      .get('/communities/10000000-0000-4000-8000-000000000001')
      .set('Authorization', token)
      .expect(403);
    await request(server())
      .get('/registration-administration')
      .set('Authorization', token)
      .expect(403);
  });
  it('rejects invalid payment amounts and decisions, and preserves rejected application evidence', async () => {
    const item = await submit(),
      id = item.a.id;
    for (const amountMinor of [-100, 0, 1, 100.5, 1000000000000]) {
      await request(server())
        .post(`/community-registrations/${id}/payments`)
        .set('Cookie', item.cookie)
        .send({
          requestId: randomUUID(),
          amountMinor,
          transactionReference: randomUUID(),
        })
        .expect(400);
    }
    await initial(item);
    await adminPost(`/${id}/review`, {
      decision: 'REJECTED',
      reason: '',
    }).expect(400);
    const rejected = data<Application>(
      await adminPost(`/${id}/review`, {
        decision: 'REJECTED',
        reason: 'Authority cannot be verified',
      }).expect(201),
    );
    expect(rejected.reconciliationRequired).toBe(true);
    expect(rejected.payments).toHaveLength(1);
    await adminPost(`/${id}/review`, {
      decision: 'APPROVED',
      reason: 'Attempted reopening',
      confirmedAuthority: true,
    }).expect(409);
    await adminPost(`/${id}/activate`).expect(403);
    await request(server())
      .post(`/community-registrations/${id}/setup-session`)
      .set('Cookie', item.cookie)
      .send({})
      .expect(409);
  });
  it('limits abusive repeated public requests', async () => {
    for (let i = 0; i < 90; i++)
      await request(server())
        .get('/community-registrations/pricing')
        .expect(200);
    await request(server()).get('/community-registrations/pricing').expect(429);
  });
  it('completes evaluation payments, retries simulated email failures and enables login directly on approval', async () => {
    const item = await submit(),
      id = item.a.id;
    const pay = (body: object) =>
      request(server())
        .post(`/community-registrations/${id}/mock-payments`)
        .set('Cookie', item.cookie)
        .send(body);
    const accept = (body: object) =>
      adminPost(`/${id}/accept-and-notify`, body);
    const approval = {
      reason: 'Authority independently checked',
      confirmedAuthority: true,
    };
    await accept(approval).expect(400);
    await request(server())
      .post(`/registration-administration/${id}/accept-and-notify`)
      .set('Authorization', auth('community.admin@urbanity.local'))
      .send(approval)
      .expect(403);
    await pay({ requestId: randomUUID(), phase: 'REMAINING' }).expect(403);
    await pay({
      requestId: randomUUID(),
      phase: 'INITIAL',
      amountMinor: 1,
    }).expect(400);
    await request(server())
      .post(`/community-registrations/${id}/mock-payments`)
      .send({ requestId: randomUUID(), phase: 'INITIAL' })
      .expect(401);
    const firstId = randomUUID();
    const initial = data<Application>(
      await pay({ requestId: firstId, phase: 'INITIAL' }).expect(201),
    );
    expect(initial).toMatchObject({
      decision: 'PENDING',
      status: 'AWAITING_REVIEW',
      verifiedMinor: 44000,
      mockVerifiedMinor: 44000,
      outstandingMinor: 176000,
    });
    expect(initial.payments[0].kind).toBe('MOCK');
    expect(
      data<Application>(
        await pay({ requestId: firstId, phase: 'INITIAL' }).expect(201),
      ).payments,
    ).toHaveLength(1);
    expect(
      data<Application>(
        await pay({ requestId: randomUUID(), phase: 'INITIAL' }).expect(201),
      ).payments,
    ).toHaveLength(1);
    await adminPost(`/${id}/activate`).expect(403);
    const fault = jest
      .spyOn(app.get(RegistrationService), 'recordApprovalNotification')
      .mockImplementationOnce(() => {
        throw new Error('Notification store unavailable');
      });
    const partial = data<ReturnType<RegistrationService['acceptAndNotify']>>(
      await accept(approval).expect(201),
    );
    expect(partial).toMatchObject({
      decision: 'APPROVED',
      notificationStatus: 'FAILED',
      notifications: [],
    });
    expect(partial.message).not.toContain('successfully');
    fault.mockRestore();
    const accepted = data<ReturnType<RegistrationService['acceptAndNotify']>>(
      await accept({ reason: 'Retry simulated email' }).expect(201),
    );
    expect(accepted.adminId).toBe(partial.adminId);
    expect(accepted.message).toBe(
      'Application accepted and email sent successfully.',
    );
    expect(accepted.notifications).toHaveLength(1);
    expect(accepted.notifications[0].status).toBe('SIMULATED');
    const retry = data<Application>(
      await accept({ reason: 'Repeat simulated email' }).expect(201),
    );
    expect(retry.notifications).toHaveLength(1);
    expect(retry.audit.filter((e) => e.action === 'APPROVED')).toHaveLength(1);
    expect(accepted.status).toBe('ACTIVE');
    await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      })
      .expect(201);
    const paid = data<Application>(
      await pay({ requestId: randomUUID(), phase: 'REMAINING' }).expect(201),
    );
    expect(paid.outstandingMinor).toBe(0);
    expect(paid.mockVerifiedMinor).toBe(220000);
    expect(
      data<Application>(
        await pay({ requestId: randomUUID(), phase: 'REMAINING' }).expect(201),
      ).payments,
    ).toHaveLength(2);
    expect(
      data<Application>(await adminPost(`/${id}/activate`).expect(201)).status,
    ).toBe('ACTIVE');
    const login = await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      })
      .expect(201);
    const token = `Bearer ${data<{ accessToken: string }>(login).accessToken}`;
    const updated = await request(server())
      .patch(`/users/${accepted.adminId}`)
      .set('Authorization', token)
      .send({ email: item.body.email, password: 'Changed-profile-password' })
      .expect(200);
    expect(data<object>(updated)).not.toHaveProperty('passwordHash');
    await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      })
      .expect(401);
    await request(server())
      .post('/auth/login')
      .send({ email: item.body.email, password: 'Changed-profile-password' })
      .expect(201);
    await request(server())
      .patch(`/users/${accepted.adminId}`)
      .set('Authorization', auth())
      .send({ password: DEFAULT_COMMUNITY_ADMIN_PASSWORD })
      .expect(403);
  });
});
