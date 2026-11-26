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
import { RegistrationService } from '../src/modules/registrations/registration.service';
import { SubscriptionService } from '../src/modules/subscriptions/subscription.service';

type Application = ReturnType<RegistrationService['status']>;
const data = <T>(r: Response) => (r.body as { data: T }).data;
const cookies = (r: Response) =>
  (r.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);
const applicantPassword = 'Individual-api-fixture-password';

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
  const configureApplicantPassword = async (item: Awaited<ReturnType<typeof submit>>) => {
    const path = `/community-registrations/${item.a.id}`;
    const grant = await request(server()).post(`${path}/setup-session`).set('Cookie', item.cookie).send({}).expect(201);
    const setup = await request(server()).post(`${path}/credential-setup`)
      .set('Cookie', [...item.cookie, ...cookies(grant)]).send({ password: applicantPassword }).expect(201);
    expect(data(setup)).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(data(setup))).not.toContain(applicantPassword);
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
      .expect(401);
    await request(server())
      .post('/subscriptions/me/mock-payment')
      .set('Authorization', forged)
      .send({})
      .expect(401);
    await request(server())
      .post('/towers')
      .set('Authorization', auth())
      .send({ communityId: approved.communityId, name: 'Early', code: 'EARLY' })
      .expect(403);
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
    await request(server()).post('/auth/login').send({ email: item.body.email, password: '1234567890' }).expect(401);
    await configureApplicantPassword(item);
    await request(server())
      .post(`/community-registrations/${id}/setup-session`)
      .set('Cookie', item.cookie)
      .send({})
      .expect(409);
    await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: applicantPassword,
      })
      .expect(201);
    await adminPost(`/${id}/activate`).expect(201);
    await request(server())
        .post(`/community-registrations/${id}/payments`)
        .set('Cookie', item.cookie)
        .send({
          requestId: randomUUID(),
          amountMinor: approved.outstandingMinor,
          transactionReference: 'REMAINING-TRANSFER-1',
        })
        .expect(403);
    await request(server()).post('/platform-payments/mock-balance')
      .set('Authorization', forged).send({ confirmed: true }).expect(201);
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
        password: applicantPassword,
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
      'Application accepted and simulated email recorded successfully.',
    );
    expect(accepted.notifications).toHaveLength(1);
    expect(accepted.notifications[0].status).toBe('SIMULATED');
    const retry = data<Application>(
      await accept({ reason: 'Repeat simulated email' }).expect(201),
    );
    expect(retry.notifications).toHaveLength(1);
    expect(retry.audit.filter((e) => e.action === 'APPROVED')).toHaveLength(1);
    expect(accepted.status).toBe('AWAITING_ACCOUNT_SETUP');
    await configureApplicantPassword(item);
    const pendingLogin = await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: applicantPassword,
      })
      .expect(201);
    const pendingToken = `Bearer ${data<{ accessToken: string }>(pendingLogin).accessToken}`;
    expect(data(pendingLogin)).toMatchObject({ user: { platformPaymentRequired: true } });
    await request(server()).get('/auth/me').set('Authorization', pendingToken)
      .expect(200).expect((response) => expect(data(response)).toMatchObject({ platformPaymentRequired: true }));
    await request(server()).get('/dashboard/summary').set('Authorization', pendingToken).expect(403);
    await request(server()).get('/complaints').set('Authorization', pendingToken).expect(403);
    await request(server()).get('/dashboard/summary').set('Authorization', auth()).expect(200);
    await request(server()).get('/dashboard/summary').set('Authorization', auth('community.admin.b@urbanity.local')).expect(200);
    await request(server()).get('/platform-payments/summary').set('Authorization', pendingToken).expect(200)
      .expect((response) => expect(data(response)).toMatchObject({ totalMinor: 220000, initialVerifiedMinor: 44000, outstandingMinor: 176000, paymentStatus: 'BALANCE_PAYMENT_PENDING' }));
    await request(server()).get('/platform-payments/history').set('Authorization', pendingToken).expect(200)
      .expect((response) => expect(data(response)).toHaveLength(1));
    await pay({ requestId: randomUUID(), phase: 'REMAINING' }).expect(403);
    const balance = (body: object, token = pendingToken) => request(server()).post('/platform-payments/mock-balance')
      .set('Authorization', token).send(body);
    await balance({ confirmed: true }, auth('community.admin.b@urbanity.local')).expect(403);
    await balance({ confirmed: true }, auth()).expect(403);
    await balance({ confirmed: false }).expect(400);
    await balance({ confirmed: true, amountMinor: 1, communityId: accepted.communityId }).expect(400);
    const receipts = await Promise.all(Array.from({ length: 5 }, () => balance({ confirmed: true }).expect(201)));
    const receipt = data<Application['payments'][number]>(receipts[0]);
    expect(receipt).toMatchObject({ kind: 'MOCK', phase: 'REMAINING', amountMinor: 176000, status: 'VERIFIED', payer: { userId: accepted.adminId } });
    expect(receipt.transactionReference).not.toBe(initial.payments[0].transactionReference);
    expect(receipts.map(data)).toEqual(Array(5).fill(receipt));
    await request(server()).get(`/platform-payments/history/${receipt.id}`).set('Authorization', pendingToken).expect(200)
      .expect((response) => expect(data(response)).toEqual(receipt));
    await request(server()).get(`/platform-payments/history/${receipt.id}`).set('Authorization', auth('community.admin.b@urbanity.local')).expect(403);
    await request(server()).get('/platform-payments/history').set('Authorization', pendingToken).expect(200)
      .expect((response) => expect(data(response)).toHaveLength(2));
    await request(server()).get('/platform-payments/summary').set('Authorization', pendingToken).expect(200)
      .expect((response) => expect(data(response)).toMatchObject({ paidMinor: 220000, outstandingMinor: 0, paymentStatus: 'FULLY_PAID' }));
    await request(server()).get('/dashboard/summary').set('Authorization', pendingToken).expect(200);
    await request(server()).get('/auth/me').set('Authorization', pendingToken).expect(200)
      .expect((response) => expect(data(response)).not.toHaveProperty('platformPaymentRequired'));
    expect(
      data<Application>(await adminPost(`/${id}/activate`).expect(201)).status,
    ).toBe('ACTIVE');
    const login = await request(server())
      .post('/auth/login')
      .send({
        email: item.body.email,
        password: applicantPassword,
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
        password: applicantPassword,
      })
      .expect(401);
    await request(server())
      .post('/auth/login')
      .send({ email: item.body.email, password: 'Changed-profile-password' })
      .expect(201);
    await request(server())
      .patch(`/users/${accepted.adminId}`)
      .set('Authorization', auth())
      .send({ password: applicantPassword })
      .expect(403);
  });

  it('enforces platform access for each community role without blocking Super Admin or unrelated communities', async () => {
    const admin = SEEDED_USERS.find((user) => user.email === 'community.admin@urbanity.local')!;
    app.get(SubscriptionService).createPending(admin.communityId!, 'Pending community', 3, 12);
    const scopedRoles = [
      'community.admin@urbanity.local',
      'tower.representative@urbanity.local',
      'resident@urbanity.local',
      'maintenance.worker@urbanity.local',
    ];
    for (const email of scopedRoles) {
      await request(server()).get('/auth/me').set('Authorization', auth(email)).expect(200)
        .expect((response) => expect(data(response)).toMatchObject({ platformPaymentRequired: true }));
      await request(server()).get('/complaints').set('Authorization', auth(email)).expect(403);
      await request(server()).get('/platform-payments/summary').set('Authorization', auth(email))
        .expect(email === admin.email ? 200 : 403);
    }
    await request(server()).get('/complaints').set('Authorization', auth()).expect(200);
    await request(server()).get('/complaints').set('Authorization', auth('community.admin.b@urbanity.local')).expect(200);
    await request(server()).post('/subscriptions/me/mock-payment').set('Authorization', auth(admin.email)).send({}).expect(201);
    for (const email of scopedRoles) {
      await request(server()).get('/complaints').set('Authorization', auth(email)).expect(200);
      await request(server()).get('/registration-administration').set('Authorization', auth(email)).expect(403);
    }
  });

  it('keeps the platform installments and complaint worker compensation in separate ledgers for the same community', async () => {
    const item = await submit();
    const { id } = item.a;
    await request(server()).post(`/community-registrations/${id}/mock-payments`)
      .set('Cookie', item.cookie).send({ requestId: randomUUID(), phase: 'INITIAL' }).expect(201);
    const approval = data<Application>(await adminPost(`/${id}/review`, {
      decision: 'APPROVED', reason: 'Authority verified', confirmedAuthority: true,
    }).expect(201));
    await configureApplicantPassword(item);
    const jwt = app.get(JwtService);
    const bearer = (userId: string) => `Bearer ${jwt.sign({ sub: userId })}`;
    const admin = bearer(approval.adminId!);
    const post = (path: string, body: object, token = admin) =>
      request(server()).post(path).set('Authorization', token).send(body);
    const patch = (path: string, body: object, token: string) =>
      request(server()).patch(path).set('Authorization', token).send(body);
    const platformHistory = async () => data<Application['payments']>(
      await request(server()).get('/platform-payments/history').set('Authorization', admin).expect(200),
    );
    const workerPaymentPath = (complaintId: string, estimateId: string) =>
      `/complaints/${complaintId}/estimates/${estimateId}/mock-payment`;

    await post(workerPaymentPath(randomUUID(), randomUUID()), { confirmed: true }).expect(403);
    expect(await platformHistory()).toEqual([expect.objectContaining({ phase: 'INITIAL', amountMinor: 44000 })]);
    const balance = data<Application['payments'][number]>(await post('/platform-payments/mock-balance', { confirmed: true }).expect(201));
    const installments = await platformHistory();
    expect(installments).toEqual([expect.objectContaining({ phase: 'INITIAL', amountMinor: 44000 }), balance]);
    expect(balance).toMatchObject({ phase: 'REMAINING', amountMinor: 176000 });

    const tower = data<{ id: string }>(await post('/towers', { communityId: approval.communityId, name: 'Test tower', code: 'T1' }).expect(201));
    const floor = data<{ id: string }>(await post('/floors', { towerId: tower.id, floorNumber: 1, label: 'One' }).expect(201));
    const apartment = data<{ id: string }>(await post('/apartments', { floorId: floor.id, apartmentNumber: '101', label: '101' }).expect(201));
    const account = async (role: string, scope: object) => data<{ id: string }>(await post('/users', {
      role, ...scope, name: 'Integration fixture', email: `${randomUUID()}@example.test`, password: randomUUID(),
    }).expect(201));
    const representative = bearer((await account('TOWER_REPRESENTATIVE', { towerId: tower.id })).id);
    const resident = bearer((await account('RESIDENT', { apartmentId: apartment.id, residentSituation: 'OWNER_OCCUPANT' })).id);
    const workerAccount = await account('MAINTENANCE_WORKER', { communityId: approval.communityId });
    const worker = bearer(workerAccount.id);
    const profile = data<{ id: string }>(await post('/workforce/workers', { userId: workerAccount.id, specialization: 'PLUMBING' }).expect(201));
    const complaint = data<{ id: string }>(await post('/complaints', {
      type: 'APARTMENT', title: 'Integration leak', description: 'The sink drain has a leak.', requiredWorkType: 'PLUMBING',
    }, resident).expect(201));
    const path = `/complaints/${complaint.id}`;
    await patch(`${path}/status`, { status: 'UNDER_REVIEW' }, representative).expect(200);
    await post(`${path}/assign`, { workerId: profile.id }, representative).expect(201);
    const submitted = data<{ estimate: { id: string } }>(await post(`${path}/estimate`, {
      inspection: 'The drain trap leaks under the sink.',
      proposedResolution: 'Replace the drain trap and verify the repair.',
      notes: 'The sink is accessible.',
      completionHours: 2,
      costs: [{ category: 'MATERIAL', description: 'Drain trap', quantity: 1, unitPricePaise: 12550 }],
    }, worker).expect(201));
    const estimateId = submitted.estimate.id;
    const revision = `${path}/estimates/${estimateId}`;
    await patch(`${revision}/tower-decision`, { decision: 'APPROVE' }, representative).expect(200);
    await patch(`${revision}/admin-decision`, { decision: 'APPROVE' }, admin).expect(200);
    await post(workerPaymentPath(complaint.id, balance.id), { confirmed: true }).expect(409);
    const receipt = data<{ id: string; reference: string }>(await post(workerPaymentPath(complaint.id, estimateId), { confirmed: true }).expect(201));
    expect(receipt).toMatchObject({
      complaintId: complaint.id, estimateId, workerId: profile.id, initiatedBy: approval.adminId,
      amountPaise: 12550, status: 'SUCCESS',
    });
    expect(receipt.reference).not.toBe(balance.transactionReference);
    expect(await platformHistory()).toEqual(installments);
    await request(server()).get(`/platform-payments/history/${receipt.id}`).set('Authorization', admin).expect(404);
    expect(data(await post('/platform-payments/mock-balance', { confirmed: true }).expect(201))).toEqual(balance);
    await request(server()).get('/platform-payments/summary').set('Authorization', admin).expect(200)
      .expect((response) => expect(data(response)).toMatchObject({ paymentStatus: 'FULLY_PAID', paidMinor: 220000 }));
    await request(server()).get(`${path}/estimate`).set('Authorization', admin).expect(200)
      .expect((response) => expect(data(response)).toMatchObject({ status: 'PAID', payment: receipt, complaint: { status: 'ASSIGNED' } }));
  }, 30_000);
});
