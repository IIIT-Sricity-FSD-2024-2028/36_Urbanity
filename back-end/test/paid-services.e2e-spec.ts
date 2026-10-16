import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SEEDED_USERS } from '../src/data/urbanity.resources';
import { LOG_DIRECTORY } from '../src/common/logging/logging.constants';
import { LoggingService } from '../src/common/logging/logging.service';
import { PAID_SERVICE_UPLOAD_DIRECTORY } from '../src/modules/paid-services/paid-service-evidence.service';

jest.setTimeout(30000);
const root = '/paid-services';
const workerId = '50000000-0000-4000-8000-000000000001';
const electricianId = '50000000-0000-4000-8000-000000000002';
const workerBId = '50000000-0000-4000-8000-000000000005';
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

describe('F04 paid services marketplace', () => {
  let app: INestApplication, server: any, directory: string;
  let tokens: Record<string, string>;
  let entry: any;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'urbanity-f04-'));
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOG_DIRECTORY).useValue(join(directory, 'logs'))
      .overrideProvider(PAID_SERVICE_UPLOAD_DIRECTORY).useValue(join(directory, 'evidence')).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init(); server = app.getHttpServer();
    tokens = {};
    const accounts = {
      admin: 'community.admin@urbanity.local', resident: 'resident@urbanity.local', worker: 'maintenance.worker@urbanity.local',
      representative: 'tower.representative@urbanity.local', adminB: 'community.admin.b@urbanity.local',
      residentB: 'resident.b@urbanity.local', workerB: 'maintenance.worker.b@urbanity.local', super: 'superadmin@urbanity.local',
    };
    for (const [key, email] of Object.entries(accounts)) {
      const user = SEEDED_USERS.find((item) => item.email === email)!;
      tokens[key] = `Bearer ${app.get(JwtService).sign({ sub: user.id, role: user.role, email }, { expiresIn: '2h' })}`;
    }
    entry = (await request(server).post(`${root}/catalogue`).set('Authorization', tokens.admin).send({ name: 'Kitchen plumbing', description: 'Private apartment plumbing service', specialization: 'PLUMBING', startingPricePaise: 10000, active: true }).expect(201)).body.data;
  });
  afterEach(async () => { jest.restoreAllMocks(); await app?.get(LoggingService).flush(); await app?.close(); await rm(directory, { recursive: true, force: true, maxRetries: 3 }); });
  const create = async (actor = 'resident', catalogueId?: string, clientRequestId = randomUUID()) => (await request(server).post(`${root}/requests`).set('Authorization', tokens[actor]).send({ catalogueId: catalogueId || entry.id, clientRequestId, description: 'Replace kitchen tap' }).expect(201)).body.data;
  const get = async (id: string, actor = 'resident') => (await request(server).get(`${root}/requests/${id}`).set('Authorization', tokens[actor]).expect(200)).body.data;
  const action = async (item: any, name: string, actor: string, body = {}, expected = 201) => (await request(server).post(`${root}/requests/${item.id}/${name}`).set('Authorization', tokens[actor]).send({ version: item.version, ...body }).expect(expected)).body.data;
  async function estimated() {
    let item = await create();
    item = await action(item, 'assign', 'representative', { workerId });
    return action(item, 'estimates', 'worker', { amountPaise: 15000, description: 'Tap and labour, total INR 150' });
  }
  async function scheduled() {
    let item = await estimated();
    item = await action(item, 'estimate-decision', 'resident', { estimateId: item.estimates[0].id, decision: 'APPROVE' });
    const start = Date.now() + 60000;
    return action(item, 'schedule', 'resident', { startsAt: new Date(start).toISOString(), endsAt: new Date(start + 3600000).toISOString() });
  }
  async function started() {
    let item = await scheduled();
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(item.appointment.startsAt) + 1000);
    return action(item, 'start', 'worker');
  }
  async function completed() { return action(await started(), 'complete', 'worker', { finalCostPaise: 14000, completionReport: 'Tap replaced and checked for leaks' }); }
  async function paymentApproved() {
    let item = await completed();
    item = await action(item, 'final-cost-review', 'representative', { approved: true, note: 'Scope completed and final bill checked' });
    return action(item, 'payment-approval', 'admin');
  }

  it('requires authentication and catalogue management authority, validates amounts and community scope', async () => {
    await request(server).get(`${root}/catalogue`).expect(401);
    await request(server).post(`${root}/catalogue`).set('Authorization', tokens.resident).send({}).expect(403);
    await request(server).get(`${root}/catalogue`).set('Authorization', tokens.super).expect(403);
    await request(server).post(`${root}/catalogue`).set('Authorization', tokens.admin).send({ name: '   ', description: 'Test', specialization: 'PLUMBING', startingPricePaise: 0, active: true }).expect(400);
    await request(server).patch(`${root}/catalogue/${entry.id}`).set('Authorization', tokens.adminB).send({ active: false }).expect(403);
    await request(server).patch(`${root}/catalogue/${entry.id}`).set('Authorization', tokens.admin).send({ active: null }).expect(400);
    await request(server).get(`${root}/catalogue`).set('Authorization', tokens.residentB).expect(200).expect(({ body }) => expect(body.data).toEqual([]));
    await request(server).post(`${root}/requests`).set('Authorization', tokens.residentB).send({ catalogueId: entry.id, clientRequestId: randomUUID(), description: 'Test' }).expect(400);
  });
  it('derives request ownership, deduplicates retries and snapshots catalogue pricing', async () => {
    const key = randomUUID(), item = await create('resident', entry.id, key);
    expect((await create('resident', entry.id, key)).id).toBe(item.id);
    await request(server).post(`${root}/requests`).set('Authorization', tokens.resident).send({ catalogueId: entry.id, clientRequestId: key, description: 'Different work' }).expect(409);
    await request(server).post(`${root}/requests`).set('Authorization', tokens.resident).send({ catalogueId: entry.id, clientRequestId: randomUUID(), description: 'Test', residentId: 'fake' }).expect(400);
    await request(server).patch(`${root}/catalogue/${entry.id}`).set('Authorization', tokens.admin).send({ startingPricePaise: 30000, active: false }).expect(200);
    expect((await get(item.id)).service.startingPricePaise).toBe(10000);
    await request(server).post(`${root}/requests`).set('Authorization', tokens.resident).send({ catalogueId: entry.id, clientRequestId: randomUUID(), description: 'Test' }).expect(400);
  });
  it('isolates requests by community, resident, assigned worker, and tower', async () => {
    const item = await create();
    for (const actor of ['adminB', 'residentB', 'workerB', 'worker']) await request(server).get(`${root}/requests/${item.id}`).set('Authorization', tokens[actor]).expect(403);
    await request(server).get(`${root}/requests`).set('Authorization', tokens.adminB).expect(200).expect(({ body }) => expect(body.data).toEqual([]));
    const other = SEEDED_USERS.find((user) => user.email === 'tower.representative.b@urbanity.local');
    const secondTower = SEEDED_USERS.find((user) => user.towerId === '20000000-0000-4000-8000-000000000002');
    const user = other || secondTower!;
    const token = `Bearer ${app.get(JwtService).sign({ sub: user.id })}`;
    await request(server).get(`${root}/requests/${item.id}`).set('Authorization', token).expect(403);
    await action(item, 'assign', 'resident', { workerId }, 403);
    await action(item, 'assign', 'representative', { workerId });
    await get(item.id, 'worker');
  });
  it('assigns only qualified available workers and reserves them across complaint and service work', async () => {
    let item = await create();
    await action(item, 'assign', 'admin', { workerId: workerBId }, 400);
    await action(item, 'assign', 'admin', { workerId: electricianId }, 400);
    item = await action(item, 'assign', 'admin', { workerId });
    const second = await create();
    await action(second, 'assign', 'admin', { workerId }, 400);
    await request(server).patch(`/workforce/workers/${workerId}`).set('Authorization', tokens.admin).send({ status: 'AVAILABLE' }).expect(400);
    await request(server).delete(`/workforce/workers/${workerId}`).set('Authorization', tokens.admin).expect(400);
    const complaintId = '60000000-0000-4000-8000-000000000001';
    await request(server).patch(`/complaints/${complaintId}/status`).set('Authorization', tokens.representative).send({ status: 'UNDER_REVIEW' }).expect(200);
    await request(server).post(`/complaints/${complaintId}/assign`).set('Authorization', tokens.representative).send({ workerId }).expect(400);
    await action(item, 'cancel', 'resident');
    await request(server).post(`/complaints/${complaintId}/assign`).set('Authorization', tokens.representative).send({ workerId }).expect(201);
    await action(second, 'assign', 'admin', { workerId }, 400);
  });
  it('blocks work before resident approval, supports rejection and revisions, and checks request versions', async () => {
    let item = await estimated();
    await action(item, 'start', 'worker', {}, 400);
    await action(item, 'estimate-decision', 'worker', { estimateId: item.estimates[0].id, decision: 'APPROVE' }, 403);
    await action(item, 'estimate-decision', 'resident', { estimateId: item.estimates[0].id, decision: 'REJECT' }, 400);
    const stale = item;
    item = await action(item, 'estimate-decision', 'resident', { estimateId: item.estimates[0].id, decision: 'REQUEST_REVISION', note: 'Reduce material cost' });
    await action(stale, 'estimate-decision', 'resident', { estimateId: stale.estimates[0].id, decision: 'APPROVE' }, 409);
    item = await action(item, 'estimates', 'worker', { amountPaise: 14000, description: 'Lower-priced tap' });
    item = await action(item, 'estimate-decision', 'resident', { estimateId: item.estimates[1].id, decision: 'REJECT', note: 'Still too expensive' });
    expect(item.status).toBe('ESTIMATE_REJECTED');
    await action(item, 'start', 'worker', {}, 400);
  });
  it('validates scheduling windows, timezone, expiry and resident appointment conflicts', async () => {
    let first = await scheduled();
    await action(first, 'start', 'worker', {}, 400);
    await action(first, 'schedule', 'resident', { startsAt: '2020-01-01T00:00:00Z', endsAt: '2020-01-01T01:00:00Z' }, 400);
    await action(first, 'schedule', 'resident', { startsAt: '2030-01-01T10:00:00', endsAt: '2030-01-01T11:00:00' }, 400);
    const electrical = (await request(server).post(`${root}/catalogue`).set('Authorization', tokens.admin).send({ name: 'Electrical repair', description: 'Electrical service', specialization: 'ELECTRICAL', startingPricePaise: 10000, active: true }).expect(201)).body.data;
    let second = await create('resident', electrical.id);
    second = await action(second, 'assign', 'admin', { workerId: electricianId });
    const electrician = SEEDED_USERS.find((user) => user.id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5')!;
    tokens.electrician = `Bearer ${app.get(JwtService).sign({ sub: electrician.id })}`;
    second = await action(second, 'estimates', 'electrician', { amountPaise: 10000, description: 'Electrical labour' });
    second = await action(second, 'estimate-decision', 'resident', { estimateId: second.estimates[0].id, decision: 'APPROVE' });
    await action(second, 'schedule', 'resident', first.appointment, 409);
    const end = Date.parse(first.appointment.endsAt);
    await action(second, 'schedule', 'resident', { startsAt: new Date(end).toISOString(), endsAt: new Date(end + 3600000).toISOString() });
    jest.spyOn(Date, 'now').mockReturnValue(end + 1);
    await action(first, 'start', 'worker', {}, 400);
  });
  it('pauses work for an increased estimate and prevents completion until the resident approves', async () => {
    let item = await started();
    item = await action(item, 'progress', 'worker', { note: 'Existing tap removed; checking supply pipe' });
    expect(item.history.at(-1).note).toContain('checking supply pipe');
    await action(item, 'complete', 'worker', { finalCostPaise: 20000, completionReport: 'Extra pipe required' }, 400);
    item = await action(item, 'estimates', 'worker', { amountPaise: 20000, description: 'Total including additional pipe' });
    await action(item, 'progress', 'worker', { note: 'Unauthorized additional work' }, 400);
    await action(item, 'complete', 'worker', { finalCostPaise: 20000, completionReport: 'Extra pipe installed' }, 400);
    item = await action(item, 'estimate-decision', 'resident', { estimateId: item.estimates[1].id, decision: 'APPROVE' });
    expect(item.status).toBe('IN_PROGRESS');
    item = await action(item, 'complete', 'worker', { finalCostPaise: 19000, completionReport: 'Tap and extra pipe installed' });
    expect(item.status).toBe('COMPLETED');
    await action(item, 'cancel', 'resident', {}, 400);
  });
  it('requires authorized final-cost review and permits corrected bills before payment', async () => {
    let item = await completed();
    await action(item, 'payment-approval', 'admin', {}, 400);
    await action(item, 'final-cost-review', 'worker', { approved: true, note: 'My own bill' }, 403);
    item = await action(item, 'final-cost-review', 'representative', { approved: false, note: 'Correct the itemized report' });
    await action(item, 'payment-approval', 'admin', {}, 400);
    item = await action(item, 'complete', 'worker', { finalCostPaise: 13000, completionReport: 'Corrected material cost and labour report' });
    item = await action(item, 'final-cost-review', 'admin', { approved: true, note: 'Corrected report approved' });
    expect(item.status).toBe('FINAL_COST_APPROVED');
  });
  it('derives payment amount and worker payee, forbids self-approval and duplicate payment records', async () => {
    const item = await paymentApproved();
    expect(item.payment).toMatchObject({ requestId: item.id, workerId, payeeUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', amountPaise: 14000, currency: 'INR', status: 'APPROVED' });
    await action(item, 'payment-approval', 'worker', {}, 403);
    await action(item, 'payment-approval', 'resident', {}, 403);
    await action(item, 'payment-approval', 'admin', {}, 409);
    await action(item, 'payment-approval', 'admin', { amountPaise: 1, payeeUserId: 'fake' }, 400);
    expect((await get(item.id)).payment.id).toBe(item.payment.id);
  });
  it('accepts only one simultaneous payment approval for the same request version', async () => {
    let item = await completed();
    item = await action(item, 'final-cost-review', 'admin', { approved: true, note: 'Final cost checked' });
    const responses = await Promise.all([1, 2].map(() => request(server).post(`${root}/requests/${item.id}/payment-approval`).set('Authorization', tokens.admin).send({ version: item.version })));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect((await get(item.id)).payment.amountPaise).toBe(14000);
  });
  it('does not release a newer service reservation when correcting an earlier final report', async () => {
    let previous = await completed();
    previous = await action(previous, 'final-cost-review', 'admin', { approved: false, note: 'Correct report wording' });
    let next = await create();
    next = await action(next, 'assign', 'admin', { workerId });
    previous = await action(previous, 'complete', 'worker', { finalCostPaise: 14000, completionReport: 'Corrected report for earlier repair' });
    expect(previous.status).toBe('COMPLETED');
    await request(server).get('/workforce/workers/me').set('Authorization', tokens.worker).expect(200).expect(({ body }) => expect(body.data.status).toBe('BUSY'));
    await action(next, 'cancel', 'resident');
  });
  it('rejects overlapping worker appointments even for different residents', async () => {
    const first = await completed();
    const other = SEEDED_USERS.find((user) => user.id === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4')!;
    tokens.otherResident = `Bearer ${app.get(JwtService).sign({ sub: other.id }, { expiresIn: '2h' })}`;
    let next = await create('otherResident');
    next = await action(next, 'assign', 'admin', { workerId });
    next = await action(next, 'estimates', 'worker', { amountPaise: 12000, description: 'Replace another tap' });
    next = await action(next, 'estimate-decision', 'otherResident', { estimateId: next.estimates[0].id, decision: 'APPROVE' });
    await action(next, 'schedule', 'otherResident', { startsAt: new Date(Date.now() + 1000).toISOString(), endsAt: first.appointment.endsAt }, 409);
  });
  it('requires scoped payment evidence, independent verification and intended worker receipt acknowledgement', async () => {
    let item = await paymentApproved();
    await action(item, 'payment-receipt', 'worker', {}, 400);
    await action(item, 'payment-report', 'resident', { reference: 'UPI-123', evidenceId: randomUUID() }, 400);
    await request(server).post(`${root}/requests/${item.id}/evidence`).set('Authorization', tokens.worker).attach('file', png, { filename: 'receipt.png', contentType: 'image/png' }).expect(403);
    await request(server).post(`${root}/requests/${item.id}/evidence`).set('Authorization', tokens.resident).attach('file', Buffer.from('fake'), { filename: 'receipt.png', contentType: 'image/png' }).expect(400);
    item = (await request(server).post(`${root}/requests/${item.id}/evidence`).set('Authorization', tokens.resident).attach('file', png, { filename: 'receipt.png', contentType: 'image/png' }).expect(201)).body.data;
    expect(item.evidence[0]).not.toHaveProperty('storedName');
    const url = `${root}/requests/${item.id}/evidence/${item.evidence[0].id}`;
    await request(server).get(url).set('Authorization', tokens.adminB).expect(403);
    await request(server).get(url).set('Authorization', tokens.admin).expect(200).expect('Content-Type', /image\/png/);
    item = await action(item, 'payment-report', 'resident', { reference: 'UPI-123', evidenceId: item.evidence[0].id });
    expect(item.payment.status).toBe('PAYMENT_REPORTED');
    await action(item, 'payment-verification', 'resident', { approved: true, verificationNote: 'Self verify' }, 403);
    await action(item, 'payment-receipt', 'worker', {}, 400);
    item = await action(item, 'payment-verification', 'representative', { approved: false, verificationNote: 'Receipt needs correction' });
    expect(item.payment.status).toBe('APPROVED');
    item = await action(item, 'payment-report', 'resident', { reference: 'UPI-123-corrected', evidenceId: item.evidence[0].id });
    item = await action(item, 'payment-verification', 'representative', { approved: true, verificationNote: 'Checked bank receipt, payee and amount' });
    await action(item, 'payment-receipt', 'admin', {}, 403);
    item = await action(item, 'payment-receipt', 'worker');
    expect(item.payment.status).toBe('RECEIPT_CONFIRMED');
    await action(item, 'payment-receipt', 'worker', {}, 400);
  });
  it('records only an owning resident review after completion is approved', async () => {
    let item = await create();
    await action(item, 'review', 'resident', { rating: 5, feedback: 'Too early' }, 400);
    // Cancel to release this request and use a completed request for the review.
    await action(item, 'cancel', 'resident');
    item = await paymentApproved();
    await action(item, 'review', 'worker', { rating: 5, feedback: 'Self review' }, 403);
    await action(item, 'review', 'resident', { rating: 6, feedback: 'Invalid' }, 400);
    item = await action(item, 'review', 'resident', { rating: 5, feedback: 'Clean repair and good communication' });
    expect(item.review.rating).toBe(5);
    await action(item, 'review', 'resident', { rating: 4, feedback: 'Duplicate' }, 409);
  });
});
