import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RoleName } from '../../common/enums/roles.enum';
import { ComplaintStatus } from '../../common/enums/status.enum';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { ComplaintType } from '../complaints/complaints.dto';
import { ComplaintsService } from '../complaints/complaints.service';
import { WorkType, WorkerStatus } from '../workforce/workforce.dto';
import { WorkforceService } from '../workforce/workforce.service';
import { AppointmentAction, AppointmentOutcome, AppointmentStatus, AppointmentTimeSlot, RescheduleDecision } from './appointments.dto';
import { AppointmentsModule } from './appointments.module';
import { AppointmentsService } from './appointments.service';

const actor = (id: string, role: RoleName): AuthenticatedUser => ({ id, email: `${id}@test.local`, role });
const resident = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', RoleName.Resident);
const otherResident = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', RoleName.Resident);
const representative = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', RoleName.TowerRepresentative);
const otherTowerRepresentative = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', RoleName.TowerRepresentative);
const otherCommunityRepresentative = actor('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', RoleName.TowerRepresentative);
const plumber = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', RoleName.MaintenanceWorker);
const electrician = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', RoleName.MaintenanceWorker);
const communityAdmin = actor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', RoleName.CommunityAdmin);
const PLUMBER_PROFILE = '50000000-0000-4000-8000-000000000001';
const ELECTRICIAN_PROFILE = '50000000-0000-4000-8000-000000000002';
const ON_LEAVE_PROFILE = '50000000-0000-4000-8000-000000000004';
const TOWER_A_COMPLAINT = '60000000-0000-4000-8000-000000000001';
const COMMUNITY_COMPLAINT = '60000000-0000-4000-8000-000000000003';
const TODAY = '2026-10-14';
const TOMORROW = '2026-10-15';
const S0900 = AppointmentTimeSlot.Slot0900;
const S1100 = AppointmentTimeSlot.Slot1100;
const S1400 = AppointmentTimeSlot.Slot1400;

const setClock = (hours: number, minutes = 0, day = 14) => jest.setSystemTime(new Date(2026, 9, day, hours, minutes));

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let complaints: ComplaintsService;
  let workforce: WorkforceService;

  const reviewed = (id = TOWER_A_COMPLAINT) => complaints.transitionStatus(id, { status: ComplaintStatus.UnderReview }, representative);
  const requested = (date = TOMORROW, timeSlot = S0900, complaintId = TOWER_A_COMPLAINT) => service.request(resident, { complaintId, preferredDate: date, timeSlot });
  const confirmed = (date = TOMORROW, timeSlot = S0900) => {
    reviewed();
    const appointment = requested(date, timeSlot);
    return service.confirm(representative, appointment.id, { workerId: PLUMBER_PROFILE });
  };
  const resolveComplaintWork = (complaintId: string) => {
    complaints.startWork(complaintId, plumber);
    const proofId = '70000000-0000-4000-8000-000000000001';
    complaints.addAttachment(complaintId, { id: proofId, originalName: 'proof.png', storedName: 'proof.png', relativePath: 'complaints/proof.png', mimeType: 'image/png', size: 9, uploadedAt: new Date().toISOString(), uploadedByRole: RoleName.MaintenanceWorker, purpose: 'RESOLUTION_PROOF', retrievalUrl: '' });
    complaints.resolveWork(complaintId, { problemFound: 'Leak', resolutionSummary: 'Fixed', proofAttachmentIds: [proofId] }, plumber);
  };

  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'hrtime', 'performance'] });
    setClock(8);
    const moduleRef = await Test.createTestingModule({ imports: [AppointmentsModule] }).compile();
    service = moduleRef.get(AppointmentsService);
    complaints = moduleRef.get(ComplaintsService);
    workforce = moduleRef.get(WorkforceService);
  });
  afterEach(() => { jest.useRealTimers(); });

  describe('requesting', () => {
    it('lets a resident request an appointment for an own complaint and records history', () => {
      const appointment = requested(TOMORROW, S0900);
      expect(appointment).toMatchObject({ status: AppointmentStatus.Requested, requestedDate: TOMORROW, requestedTimeSlot: S0900, residentId: resident.id, complaint: { id: TOWER_A_COMPLAINT, status: ComplaintStatus.Submitted } });
      expect(appointment.history).toEqual([expect.objectContaining({ action: AppointmentAction.Requested, status: AppointmentStatus.Requested, changedByRole: RoleName.Resident, date: TOMORROW })]);
    });

    it('rejects complaints the resident cannot access, community complaints and non-resident actors', () => {
      expect(() => service.request(otherResident, { complaintId: TOWER_A_COMPLAINT, preferredDate: TOMORROW, timeSlot: S0900 })).toThrow(ForbiddenException);
      expect(() => requested(TOMORROW, S0900, COMMUNITY_COMPLAINT)).toThrow(BadRequestException);
      expect(() => service.request(representative, { complaintId: TOWER_A_COMPLAINT, preferredDate: TOMORROW, timeSlot: S0900 })).toThrow(ForbiddenException);
    });

    it('allows only one active appointment per complaint', () => {
      requested();
      expect(() => requested(TOMORROW, S1100)).toThrow(ConflictException);
    });

    it('validates slot dates', () => {
      expect(() => requested('2026-10-13', S1400)).toThrow('Choose a time slot that has not started yet');
      setClock(9, 5);
      expect(() => requested(TODAY, S0900)).toThrow('Choose a time slot that has not started yet');
      expect(() => requested('2026-02-30', S0900)).toThrow('Date is not a valid calendar date');
      expect(() => requested('2027-01-30', S0900)).toThrow('days ahead');
    });

    it('rejects complaints that no longer need a visit', () => {
      confirmed();
      resolveComplaintWork(TOWER_A_COMPLAINT);
      const [appointment] = service.listForActor(resident);
      service.cancel(representative, appointment.id, { reason: 'Work already done' });
      expect(() => requested(TOMORROW, S1100)).toThrow('Appointments cannot be scheduled for a PENDING_VERIFICATION complaint');
    });
  });

  describe('confirmation and worker assignment', () => {
    it('requires the complaint review to have started', () => {
      const appointment = requested();
      expect(() => service.confirm(representative, appointment.id, { workerId: PLUMBER_PROFILE })).toThrow('Start the complaint review');
    });

    it('confirms through the existing assignment flow without changing appointment/complaint independence', () => {
      const appointment = confirmed();
      expect(appointment).toMatchObject({ status: AppointmentStatus.Confirmed, scheduledDate: TOMORROW, scheduledTimeSlot: S0900, workerId: PLUMBER_PROFILE, complaint: { status: ComplaintStatus.Assigned, assignedWorkerId: PLUMBER_PROFILE } });
      expect(workforce.findById(PLUMBER_PROFILE).status).toBe(WorkerStatus.Busy);
      expect(appointment.history.at(-1)).toMatchObject({ action: AppointmentAction.Confirmed, workerId: PLUMBER_PROFILE });
    });

    it('allows only the responsible Tower Representative', () => {
      reviewed();
      const appointment = requested();
      expect(() => service.confirm(otherTowerRepresentative, appointment.id, { workerId: PLUMBER_PROFILE })).toThrow(ForbiddenException);
      expect(() => service.confirm(otherCommunityRepresentative, appointment.id, { workerId: PLUMBER_PROFILE })).toThrow(ForbiddenException);
      expect(() => service.confirm(communityAdmin, appointment.id, { workerId: PLUMBER_PROFILE })).toThrow(ForbiddenException);
    });

    it('rejects ineligible or unavailable workers and leaves both records unchanged', () => {
      reviewed();
      const appointment = requested();
      expect(() => service.confirm(representative, appointment.id, { workerId: ELECTRICIAN_PROFILE })).toThrow('specialization');
      expect(() => service.confirm(representative, appointment.id, { workerId: ON_LEAVE_PROFILE })).toThrow('ON_LEAVE');
      expect(service.findForActor(representative, appointment.id)).toMatchObject({ status: AppointmentStatus.Requested, complaint: { status: ComplaintStatus.UnderReview } });
    });

    it('prevents conflicting confirmed appointments for the same worker', () => {
      const first = confirmed(TOMORROW, S0900);
      resolveComplaintWork(TOWER_A_COMPLAINT);
      expect(service.findForActor(representative, first.id).status).toBe(AppointmentStatus.Confirmed);
      const complaint = complaints.create(resident, { type: ComplaintType.Apartment, title: 'Tap', description: 'Tap drips', requiredWorkType: WorkType.Plumbing });
      reviewed(complaint.id);
      const second = requested(TOMORROW, S0900, complaint.id);
      expect(() => service.confirm(representative, second.id, { workerId: PLUMBER_PROFILE })).toThrow(ConflictException);
      expect(complaints.findById(complaint.id).status).toBe(ComplaintStatus.UnderReview);
      const confirmedSecond = service.confirm(representative, second.id, { workerId: PLUMBER_PROFILE, timeSlot: S1400 });
      expect(confirmedSecond).toMatchObject({ status: AppointmentStatus.Confirmed, scheduledTimeSlot: S1400 });

      service.requestReschedule(resident, second.id, { preferredDate: TOMORROW, timeSlot: S0900, reason: 'Earlier please' });
      expect(() => service.decideReschedule(representative, second.id, { decision: RescheduleDecision.Approve })).toThrow(ConflictException);
      const declined = service.decideReschedule(representative, second.id, { decision: RescheduleDecision.Decline, note: 'Worker booked' });
      expect(declined).toMatchObject({ status: AppointmentStatus.Confirmed, scheduledTimeSlot: S1400 });
      expect(declined.rescheduleRequest).toBeUndefined();
      expect(declined.history.at(-1)).toMatchObject({ action: AppointmentAction.RescheduleDeclined, note: 'Worker booked' });
      expect(service.workerSchedule(representative, PLUMBER_PROFILE, TOMORROW).bookedSlots.map((slot) => slot.timeSlot)).toEqual([S0900, S1400]);
    });

    it('scopes worker schedules to the representative community', () => {
      expect(() => service.workerSchedule(otherCommunityRepresentative, PLUMBER_PROFILE)).toThrow(ForbiddenException);
    });
  });

  describe('rescheduling and cancellation', () => {
    it('updates a pending request while keeping the previous preference in history', () => {
      const appointment = requested(TOMORROW, S0900);
      const updated = service.requestReschedule(resident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1100, reason: 'Office call' });
      expect(updated).toMatchObject({ status: AppointmentStatus.Requested, requestedTimeSlot: S1100 });
      expect(updated.history.at(-1)).toMatchObject({ action: AppointmentAction.RequestUpdated, previousDate: TOMORROW, previousTimeSlot: S0900, timeSlot: S1100 });
      expect(() => service.requestReschedule(resident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1100, reason: 'Same' })).toThrow('different');
      expect(() => service.requestReschedule(otherResident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1400, reason: 'x' })).toThrow(ForbiddenException);
    });

    it('approves a confirmed reschedule and preserves the previous schedule', () => {
      const appointment = confirmed(TOMORROW, S0900);
      const pending = service.requestReschedule(resident, appointment.id, { preferredDate: '2026-10-16', timeSlot: S1100, reason: 'Travelling' });
      expect(pending).toMatchObject({ status: AppointmentStatus.RescheduleRequested, scheduledDate: TOMORROW, rescheduleRequest: { proposedDate: '2026-10-16', proposedTimeSlot: S1100, reason: 'Travelling' } });
      expect(() => service.requestReschedule(resident, appointment.id, { preferredDate: '2026-10-17', timeSlot: S1100, reason: 'Again' })).toThrow(BadRequestException);
      const approved = service.decideReschedule(representative, appointment.id, { decision: RescheduleDecision.Approve });
      expect(approved).toMatchObject({ status: AppointmentStatus.Confirmed, scheduledDate: '2026-10-16', scheduledTimeSlot: S1100 });
      expect(approved.history.at(-1)).toMatchObject({ action: AppointmentAction.RescheduleApproved, previousDate: TOMORROW, previousTimeSlot: S0900 });
      expect(approved.history.map((entry) => entry.action)).toEqual([AppointmentAction.Requested, AppointmentAction.Confirmed, AppointmentAction.RescheduleRequested, AppointmentAction.RescheduleApproved]);
    });

    it('records cancellation reason, timestamp and actor, then allows a new request', () => {
      const appointment = requested();
      const cancelled = service.cancel(resident, appointment.id, { reason: ' Fixed it myself ' });
      expect(cancelled).toMatchObject({ status: AppointmentStatus.Cancelled, cancellation: { reason: 'Fixed it myself', cancelledByRole: RoleName.Resident, cancelledByUserId: resident.id, cancelledAt: expect.any(String) } });
      expect(() => service.cancel(resident, appointment.id, { reason: 'again' })).toThrow('CANCELLED appointment cannot be changed');
      expect(requested(TOMORROW, S1100).status).toBe(AppointmentStatus.Requested);
    });

    it('applies the resident cut-off but lets the representative cancel', () => {
      const appointment = confirmed(TODAY, S1100);
      setClock(9, 30);
      expect(() => service.cancel(resident, appointment.id, { reason: 'Late' })).toThrow('2 hours');
      expect(() => service.requestReschedule(resident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1100, reason: 'Late' })).toThrow('2 hours');
      expect(() => service.cancel(plumber, appointment.id, { reason: 'No' })).toThrow(ForbiddenException);
      expect(() => service.cancel(otherTowerRepresentative, appointment.id, { reason: 'No' })).toThrow(ForbiddenException);
      expect(service.cancel(representative, appointment.id, { reason: 'Worker unwell' }).cancellation?.cancelledByRole).toBe(RoleName.TowerRepresentative);
    });
  });

  describe('worker visits', () => {
    it('restricts appointments to the assigned worker', () => {
      const appointment = confirmed();
      expect(service.listForActor(plumber).map((item) => item.id)).toEqual([appointment.id]);
      expect(service.listForActor(electrician)).toEqual([]);
      expect(() => service.findForActor(electrician, appointment.id)).toThrow(ForbiddenException);
      expect(() => service.recordArrival(electrician, appointment.id)).toThrow(ForbiddenException);
    });

    it('records arrival and completion without resolving the complaint', () => {
      const appointment = confirmed(TODAY, S1100);
      expect(() => service.recordArrival(plumber, appointment.id)).toThrow('Arrival can be recorded from');
      expect(() => service.recordOutcome(plumber, appointment.id, { outcome: AppointmentOutcome.Completed, notes: 'Done' })).toThrow('Record your arrival');
      setClock(10, 30);
      expect(service.recordArrival(plumber, appointment.id).arrivedAt).toEqual(expect.any(String));
      expect(() => service.recordArrival(plumber, appointment.id)).toThrow('already');
      expect(() => service.recordOutcome(plumber, appointment.id, { outcome: AppointmentOutcome.Completed, notes: 'Done', attachmentIds: ['70000000-0000-4000-8000-0000000000ff'] })).toThrow('Photos must be');
      const completed = service.recordOutcome(plumber, appointment.id, { outcome: AppointmentOutcome.Completed, notes: 'Replaced washer', followUpRequired: true });
      expect(completed).toMatchObject({ status: AppointmentStatus.Completed, outcome: { outcome: AppointmentOutcome.Completed, notes: 'Replaced washer', followUpRequired: true }, complaint: { status: ComplaintStatus.Assigned } });
      expect(complaints.findById(TOWER_A_COMPLAINT).status).toBe(ComplaintStatus.Assigned);
      expect(() => service.cancel(representative, appointment.id, { reason: 'x' })).toThrow('COMPLETED appointment cannot be changed');

      const followUp = requested(TOMORROW, S0900);
      expect(() => service.confirm(representative, followUp.id, { workerId: ELECTRICIAN_PROFILE })).toThrow('worker assigned to the complaint');
      expect(service.confirm(representative, followUp.id, { workerId: PLUMBER_PROFILE }).status).toBe(AppointmentStatus.Confirmed);
    });

    it('allows a missed visit only after the slot starts', () => {
      const appointment = confirmed(TODAY, S1100);
      expect(() => service.recordOutcome(plumber, appointment.id, { outcome: AppointmentOutcome.Missed, notes: 'Resident absent' })).toThrow('after its slot has started');
      expect(() => service.markMissed(representative, appointment.id, { reason: 'No show' })).toThrow('after its slot has started');
      setClock(11, 15);
      expect(() => service.recordOutcome(plumber, appointment.id, { outcome: AppointmentOutcome.Missed, notes: 'Absent', followUpRequired: true })).toThrow('only to completed');
      expect(() => service.markMissed(otherTowerRepresentative, appointment.id, { reason: 'No show' })).toThrow(ForbiddenException);
      expect(service.markMissed(representative, appointment.id, { reason: 'Resident absent' })).toMatchObject({ status: AppointmentStatus.Missed, outcome: { outcome: AppointmentOutcome.Missed, recordedByRole: RoleName.TowerRepresentative } });
    });
  });

  describe('edge cases', () => {
    it('rejects blank reasons and notes after trimming', () => {
      const appointment = requested();
      expect(() => service.cancel(resident, appointment.id, { reason: '   ' })).toThrow('must not be blank');
      expect(() => service.requestReschedule(resident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1100, reason: ' ' })).toThrow('must not be blank');
      expect(service.findForActor(resident, appointment.id).status).toBe(AppointmentStatus.Requested);
      service.cancel(resident, appointment.id, { reason: 'ok' });
      expect(service.request(resident, { complaintId: TOWER_A_COMPLAINT, preferredDate: TOMORROW, timeSlot: S0900, notes: '   ' }).residentNotes).toBeUndefined();
    });

    it('does not reschedule visits for complaints that no longer need on-site work', () => {
      const appointment = confirmed(TOMORROW, S0900);
      service.requestReschedule(resident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1100, reason: 'Clash' });
      resolveComplaintWork(TOWER_A_COMPLAINT);
      expect(() => service.decideReschedule(representative, appointment.id, { decision: RescheduleDecision.Approve })).toThrow('PENDING_VERIFICATION');
      expect(service.decideReschedule(representative, appointment.id, { decision: RescheduleDecision.Decline }).status).toBe(AppointmentStatus.Confirmed);
      expect(() => service.requestReschedule(resident, appointment.id, { preferredDate: TOMORROW, timeSlot: S1400, reason: 'Again' })).toThrow('PENDING_VERIFICATION');
      expect(service.cancel(representative, appointment.id, { reason: 'Work finished' }).status).toBe(AppointmentStatus.Cancelled);
    });

    it('keeps an arrived visit for the worker to close', () => {
      const appointment = confirmed(TODAY, S1100);
      setClock(11, 5);
      service.recordArrival(plumber, appointment.id);
      expect(() => service.markMissed(representative, appointment.id, { reason: 'No show' })).toThrow('recorded arrival');
      expect(() => service.cancel(representative, appointment.id, { reason: 'Stop' })).toThrow('already arrived');
      expect(service.recordOutcome(plumber, appointment.id, { outcome: AppointmentOutcome.Completed, notes: 'Fixed' }).status).toBe(AppointmentStatus.Completed);
    });

    it('releases worker slots held by appointments of deleted complaints', () => {
      confirmed(TOMORROW, S0900);
      resolveComplaintWork(TOWER_A_COMPLAINT);
      complaints.delete(communityAdmin, TOWER_A_COMPLAINT);
      expect(service.workerSchedule(representative, PLUMBER_PROFILE, TOMORROW).bookedSlots).toEqual([]);
      const complaint = complaints.create(resident, { type: ComplaintType.Apartment, title: 'Tap', description: 'Tap drips', requiredWorkType: WorkType.Plumbing });
      reviewed(complaint.id);
      const next = requested(TOMORROW, S0900, complaint.id);
      expect(service.confirm(representative, next.id, { workerId: PLUMBER_PROFILE }).status).toBe(AppointmentStatus.Confirmed);
    });

    it('hides appointment ids from other towers in worker schedules', () => {
      const complaint = complaints.create(otherResident, { type: ComplaintType.Tower, title: 'Pump', description: 'Pump noise', requiredWorkType: WorkType.Plumbing });
      complaints.transitionStatus(complaint.id, { status: ComplaintStatus.UnderReview }, otherTowerRepresentative);
      const appointment = service.request(otherResident, { complaintId: complaint.id, preferredDate: TOMORROW, timeSlot: S0900 });
      service.confirm(otherTowerRepresentative, appointment.id, { workerId: PLUMBER_PROFILE });
      expect(service.workerSchedule(representative, PLUMBER_PROFILE, TOMORROW).bookedSlots).toEqual([{ date: TOMORROW, timeSlot: S0900, status: AppointmentStatus.Confirmed }]);
      expect(service.workerSchedule(otherTowerRepresentative, PLUMBER_PROFILE, TOMORROW).bookedSlots[0].appointmentId).toBe(appointment.id);
      // The tower A request for the same worker and slot is still a conflict.
      reviewed();
      const mine = requested(TOMORROW, S0900);
      expect(() => service.confirm(representative, mine.id, { workerId: PLUMBER_PROFILE })).toThrow(ConflictException);
    });
  });

  describe('emergency complaints', () => {
    const emergencyComplaint = () => complaints.create(resident, { type: ComplaintType.Apartment, title: 'Burst pipe', description: 'Water flooding the kitchen', requiredWorkType: WorkType.Plumbing, isEmergency: true });

    it('stores the flag and exposes it on appointments', () => {
      const complaint = emergencyComplaint();
      expect(complaint.isEmergency).toBe(true);
      expect(requested(TOMORROW, S0900, complaint.id).complaint.isEmergency).toBe(true);
      expect(requested(TOMORROW, S0900).complaint.isEmergency).toBe(false);
    });

    it('allows the currently running slot only for emergencies', () => {
      setClock(9, 30);
      expect(() => requested(TODAY, S0900)).toThrow('has not started yet');
      const complaint = emergencyComplaint();
      reviewed(complaint.id);
      const appointment = requested(TODAY, S0900, complaint.id);
      expect(service.confirm(representative, appointment.id, { workerId: PLUMBER_PROFILE })).toMatchObject({ status: AppointmentStatus.Confirmed, scheduledDate: TODAY, scheduledTimeSlot: S0900 });
      expect(service.recordArrival(plumber, appointment.id).arrivedAt).toEqual(expect.any(String));
      setClock(11, 5);
      expect(() => service.request(resident, { complaintId: emergencyComplaint().id, preferredDate: TODAY, timeSlot: S0900 })).toThrow('has not ended yet');
    });

    it('lets residents change emergency visits inside the normal cut-off', () => {
      const complaint = emergencyComplaint();
      reviewed(complaint.id);
      const appointment = service.confirm(representative, requested(TODAY, S1100, complaint.id).id, { workerId: PLUMBER_PROFILE });
      setClock(10, 0);
      expect(service.requestReschedule(resident, appointment.id, { preferredDate: TODAY, timeSlot: S1400, reason: 'Need later' }).status).toBe(AppointmentStatus.RescheduleRequested);
      expect(service.cancel(resident, appointment.id, { reason: 'Fixed by plumber friend' }).status).toBe(AppointmentStatus.Cancelled);
    });
  });

  describe('visibility', () => {
    it('scopes lists by resident ownership and tower', () => {
      const appointment = requested();
      expect(service.listForActor(resident).map((item) => item.id)).toEqual([appointment.id]);
      expect(service.listForActor(otherResident)).toEqual([]);
      expect(service.listForActor(representative).map((item) => item.id)).toEqual([appointment.id]);
      expect(service.listForActor(otherTowerRepresentative)).toEqual([]);
      expect(() => service.findForActor(otherTowerRepresentative, appointment.id)).toThrow(ForbiddenException);
      expect(() => service.findForActor(otherResident, appointment.id)).toThrow(ForbiddenException);
    });
  });
});
