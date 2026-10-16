import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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

const TOWER_A_COMPLAINT = '60000000-0000-4000-8000-000000000001';
const PLUMBER_PROFILE = '50000000-0000-4000-8000-000000000001';
const ACCOUNTS = {
  superAdmin: ['superadmin@urbanity.local', 'superadmin-dev'],
  communityAdmin: ['community.admin@urbanity.local', 'community-admin-dev'],
  representative: ['tower.representative@urbanity.local', 'tower-representative-dev'],
  otherTowerRepresentative: ['tower.b.representative@urbanity.local', 'tower-b-representative-dev'],
  otherCommunityRepresentative: ['tower.representative.b@urbanity.local', 'tower-representative-b-dev'],
  resident: ['resident@urbanity.local', 'resident-dev'],
  otherResident: ['resident.two@urbanity.local', 'resident-two-dev'],
  plumber: ['maintenance.worker@urbanity.local', 'maintenance-worker-dev'],
  electrician: ['worker.electrical@urbanity.local', 'worker-electrical-dev'],
} as const;
type Account = keyof typeof ACCOUNTS;

const localDate = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

describe('Appointments API (e2e)', () => {
  let app: INestApplication;
  let server: App;
  const tokens = {} as Record<Account, string>;
  const as = (account: Account) => `Bearer ${tokens[account]}`;
  const requestAppointment = (body: Record<string, unknown> = { complaintId: TOWER_A_COMPLAINT, preferredDate: localDate(2), timeSlot: '09:00-11:00' }) =>
    request(server).post('/appointments').set('Authorization', as('resident')).send(body);

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LOG_DIRECTORY).useValue(await mkdtemp(join(tmpdir(), 'urbanity-logs-')))
      .compile();
    app = moduleFixture.createNestApplication();
    configureHttpSecurity(app);
    app.useGlobalPipes(validationPipe);
    await app.init();
    server = app.getHttpServer() as App;
    for (const [account, [email, password]] of Object.entries(ACCOUNTS)) {
      const response = await request(server).post('/auth/login').send({ email, password }).expect(201);
      tokens[account as Account] = response.body.data.accessToken;
    }
  });
  afterEach(async () => { await app.close(); });

  it('requires authentication and restricts the API to the scheduling roles', async () => {
    await request(server).get('/appointments').expect(401);
    await request(server).get('/appointments').set('Authorization', as('communityAdmin')).expect(403);
    await request(server).get('/appointments').set('Authorization', as('superAdmin')).expect(403);
    const slots = await request(server).get('/appointments/time-slots').set('Authorization', as('resident')).expect(200);
    expect(slots.body.data.map((slot: { code: string }) => slot.code)).toEqual(['09:00-11:00', '11:00-13:00', '14:00-16:00', '16:00-18:00']);
  });

  it('validates request payloads', async () => {
    await requestAppointment({ complaintId: TOWER_A_COMPLAINT, preferredDate: '20/10/2026', timeSlot: '09:00-11:00' }).expect(400);
    await requestAppointment({ complaintId: TOWER_A_COMPLAINT, preferredDate: localDate(2), timeSlot: '07:00-08:00' }).expect(400);
    await requestAppointment({ complaintId: TOWER_A_COMPLAINT, preferredDate: localDate(2), timeSlot: '09:00-11:00', residentId: 'forged' }).expect(400);
    await requestAppointment({ complaintId: TOWER_A_COMPLAINT, preferredDate: localDate(-1), timeSlot: '09:00-11:00' }).expect(400);
  });

  it('runs the request, confirm, reschedule and cancel workflow with scoped authorization', async () => {
    const created = await requestAppointment().expect(201);
    const id = created.body.data.id as string;
    expect(created.body.data).toMatchObject({ status: 'REQUESTED', complaint: { id: TOWER_A_COMPLAINT, status: 'SUBMITTED' } });

    await request(server).post('/appointments').set('Authorization', as('otherResident')).send({ complaintId: TOWER_A_COMPLAINT, preferredDate: localDate(2), timeSlot: '11:00-13:00' }).expect(403);
    await requestAppointment({ complaintId: TOWER_A_COMPLAINT, preferredDate: localDate(3), timeSlot: '11:00-13:00' }).expect(409);
    await request(server).get(`/appointments/${id}`).set('Authorization', as('otherResident')).expect(403);
    await request(server).get(`/appointments/${id}`).set('Authorization', as('otherTowerRepresentative')).expect(403);
    await request(server).get(`/appointments/${id}`).set('Authorization', as('plumber')).expect(403);
    const towerBList = await request(server).get('/appointments').set('Authorization', as('otherTowerRepresentative')).expect(200);
    expect(towerBList.body.data).toEqual([]);

    await request(server).patch(`/appointments/${id}/confirm`).set('Authorization', as('resident')).send({ workerId: PLUMBER_PROFILE }).expect(403);
    await request(server).patch(`/appointments/${id}/confirm`).set('Authorization', as('representative')).send({ workerId: PLUMBER_PROFILE }).expect(400);
    await request(server).patch(`/complaints/${TOWER_A_COMPLAINT}/status`).set('Authorization', as('representative')).send({ status: 'UNDER_REVIEW' }).expect(200);
    await request(server).patch(`/appointments/${id}/confirm`).set('Authorization', as('otherTowerRepresentative')).send({ workerId: PLUMBER_PROFILE }).expect(403);
    await request(server).get(`/appointments/workers/${PLUMBER_PROFILE}/schedule`).set('Authorization', as('otherCommunityRepresentative')).expect(403);

    const confirmed = await request(server).patch(`/appointments/${id}/confirm`).set('Authorization', as('representative')).send({ workerId: PLUMBER_PROFILE }).expect(200);
    expect(confirmed.body.data).toMatchObject({ status: 'CONFIRMED', workerId: PLUMBER_PROFILE, workerName: 'Kabir Das', complaint: { status: 'ASSIGNED' } });
    const complaint = await request(server).get(`/complaints/${TOWER_A_COMPLAINT}`).set('Authorization', as('resident')).expect(200);
    expect(complaint.body.data).toMatchObject({ status: 'ASSIGNED', assignedWorkerId: PLUMBER_PROFILE });
    const schedule = await request(server).get(`/appointments/workers/${PLUMBER_PROFILE}/schedule`).query({ date: localDate(2) }).set('Authorization', as('representative')).expect(200);
    expect(schedule.body.data.bookedSlots).toEqual([expect.objectContaining({ appointmentId: id, timeSlot: '09:00-11:00' })]);

    const workerList = await request(server).get('/appointments').set('Authorization', as('plumber')).expect(200);
    expect(workerList.body.data.map((item: { id: string }) => item.id)).toEqual([id]);
    await request(server).get(`/appointments/${id}`).set('Authorization', as('electrician')).expect(403);
    await request(server).patch(`/appointments/${id}/arrival`).set('Authorization', as('electrician')).send({}).expect(403);
    await request(server).patch(`/appointments/${id}/arrival`).set('Authorization', as('plumber')).send({}).expect(400);
    await request(server).patch(`/appointments/${id}/cancel`).set('Authorization', as('plumber')).send({ reason: 'No' }).expect(403);

    const reschedule = await request(server).patch(`/appointments/${id}/reschedule`).set('Authorization', as('resident')).send({ preferredDate: localDate(3), timeSlot: '14:00-16:00', reason: 'Travelling' }).expect(200);
    expect(reschedule.body.data).toMatchObject({ status: 'RESCHEDULE_REQUESTED', rescheduleRequest: { proposedDate: localDate(3) } });
    await request(server).patch(`/appointments/${id}/reschedule-decision`).set('Authorization', as('resident')).send({ decision: 'APPROVE' }).expect(403);
    const approved = await request(server).patch(`/appointments/${id}/reschedule-decision`).set('Authorization', as('representative')).send({ decision: 'APPROVE' }).expect(200);
    expect(approved.body.data).toMatchObject({ status: 'CONFIRMED', scheduledDate: localDate(3), scheduledTimeSlot: '14:00-16:00' });
    expect(approved.body.data.history.at(-1)).toMatchObject({ action: 'RESCHEDULE_APPROVED', previousDate: localDate(2), previousTimeSlot: '09:00-11:00' });

    await request(server).patch(`/appointments/${id}/cancel`).set('Authorization', as('resident')).send({}).expect(400);
    const cancelled = await request(server).patch(`/appointments/${id}/cancel`).set('Authorization', as('resident')).send({ reason: 'Resolved by itself' }).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', cancellation: { reason: 'Resolved by itself', cancelledByRole: 'RESIDENT', cancelledAt: expect.any(String) } });
    await request(server).patch(`/appointments/${id}/cancel`).set('Authorization', as('representative')).send({ reason: 'Again' }).expect(400);

    const after = await request(server).get(`/complaints/${TOWER_A_COMPLAINT}`).set('Authorization', as('resident')).expect(200);
    expect(after.body.data.status).toBe('ASSIGNED');
  });
});
