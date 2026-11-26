import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LOG_DIRECTORY } from '../src/common/logging/logging.constants';
import { validationPipe } from '../src/common/pipes/validation.pipe';
import { configureHttpSecurity } from '../src/config/security.config';

jest.setTimeout(30_000);
const path = '/complaints/60000000-0000-4000-8000-000000000001';
const queue = '/complaints/estimates/queue';
const estimate = {
  inspection: 'Found a cracked trap below the sink.',
  proposedResolution: 'Replace the trap and test for leaks.',
  notes: 'The sink is accessible.',
  completionHours: 2,
  costs: [{ category: 'MATERIAL', description: 'Drain trap', quantity: 2, unitPricePaise: 12550 }],
};

describe('Complaint estimates API', () => {
  let app: INestApplication;
  let server: App;
  let worker: string, tower: string, admin: string, resident: string;

  beforeAll(async () => {
    const testModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOG_DIRECTORY).useValue(await mkdtemp(join(tmpdir(), 'urbanity-estimate-logs-')))
      .compile();
    app = testModule.createNestApplication({ logger: false });
    configureHttpSecurity(app);
    app.useGlobalPipes(validationPipe);
    await app.init();
    server = app.getHttpServer() as App;
    const login = async (email: string, password: string) => {
      const response = await request(server).post('/auth/login').send({ email, password }).expect(201);
      return `Bearer ${response.body.data.accessToken}`;
    };
    worker = await login('maintenance.worker@urbanity.local', 'maintenance-worker-dev');
    tower = await login('tower.representative@urbanity.local', 'tower-representative-dev');
    admin = await login('community.admin@urbanity.local', 'community-admin-dev');
    resident = await login('resident@urbanity.local', 'resident-dev');
  });
  afterAll(async () => { await app?.close(); });

  it('validates payloads, protects the workflow and commits one receipt under concurrent requests', async () => {
    await request(server).get(queue).expect(401);
    await request(server).get(queue).set('Authorization', resident).expect(403);
    await request(server).get(queue).set('Authorization', tower).expect(200, { success: true, data: [] });
    await request(server).patch(`${path}/start`).set('Authorization', worker).send({}).expect(403);
    await request(server).patch(`${path}/status`).set('Authorization', worker).send({ status: 'RESOLVED' }).expect(403);
    await request(server).patch(`${path}/status`).set('Authorization', tower).send({ status: 'UNDER_REVIEW' }).expect(200);
    await request(server).post(`${path}/assign`).set('Authorization', tower)
      .send({ workerId: '50000000-0000-4000-8000-000000000001' }).expect(201);
    await request(server).delete(path).set('Authorization', admin).expect(409);
    const submit = (body: object) => request(server).post(`${path}/estimate`).set('Authorization', worker).send(body);
    await submit({ ...estimate, totalPaise: 1 }).expect(400);
    await submit({ ...estimate, inspection: '          ' }).expect(400);
    await submit({ ...estimate, proposedResolution: ' short ' }).expect(400);
    await submit({ ...estimate, notes: ' ' }).expect(400);
    await submit({ ...estimate, costs: [] }).expect(400);
    for (const unitPricePaise of [-1, 1.5, '1', null]) {
      await submit({ ...estimate, costs: [{ ...estimate.costs[0], unitPricePaise }] }).expect(400);
    }
    await submit({ ...estimate, costs: [{ ...estimate.costs[0], subtotalPaise: 1 }] }).expect(400);
    const submitted = await submit(estimate).expect(201);
    await request(server).patch(`${path}/start`).set('Authorization', worker).send({}).expect(409);
    const revision = `${path}/estimates/${submitted.body.data.estimate.id}`;
    const approve = { decision: 'APPROVE' };
    const unrelatedComplaint = '/complaints/60000000-0000-4000-8000-000000000002';
    await request(server).patch(`${unrelatedComplaint}/estimates/${submitted.body.data.estimate.id}/admin-decision`)
      .set('Authorization', admin).send(approve).expect(409);
    await request(server).patch(`${revision}/tower-decision`).set('Authorization', worker).send(approve).expect(403);
    await request(server).patch(`${revision}/tower-decision`).set('Authorization', tower).send(approve).expect(200);
    await request(server).patch(`${revision}/admin-decision`).set('Authorization', admin).send(approve).expect(200);
    const pay = (body: object) => request(server).post(`${revision}/mock-payment`).set('Authorization', admin).send(body);
    await pay({}).expect(400);
    await pay({ confirmed: false }).expect(400);
    await pay({ confirmed: true, amountPaise: 1 }).expect(400);
    const receipts = await Promise.all(Array.from({ length: 5 }, () => pay({ confirmed: true }).expect(201)));
    const receipt = receipts[0].body.data;
    expect(receipt).toMatchObject({ mock: true, status: 'SUCCESS', amountPaise: 25100, reference: /^MOCK-/ });
    expect(receipts.map(({ body }) => body.data)).toEqual(Array(5).fill(receipt));
    await request(server).patch(`${path}/status`).set('Authorization', tower).send({ status: 'RESOLVED' }).expect(400);
    const history = await request(server).get(queue).set('Authorization', admin).expect(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({ status: 'PAID', payment: receipt });
    const publicProgress = await request(server).get(`${path}/estimate`).set('Authorization', resident).expect(200);
    expect(publicProgress.body.data).toEqual({ available: true, assigned: true, status: 'PAID' });
    await request(server).patch(`${path}/start`).set('Authorization', worker).send({}).expect(200);
  });
});
