import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { ComplaintStatus } from '../../common/enums/status.enum';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityComplaint, ComplaintType } from '../complaints/complaints.dto';
import { ComplaintsService } from '../complaints/complaints.service';
import { WorkerProfile, WorkerStatus } from '../workforce/workforce.dto';
import { WorkforceService } from '../workforce/workforce.service';
import {
  ACTIVE_APPOINTMENT_STATUSES, Appointment, AppointmentAction, AppointmentHistoryEntry, AppointmentOutcome, AppointmentStatus, AppointmentTimeSlot,
  CancelAppointmentDto, ConfirmAppointmentDto, CreateAppointmentDto, MarkMissedDto, RecordOutcomeDto, RequestRescheduleDto, RescheduleDecision,
  RescheduleDecisionDto, SCHEDULABLE_COMPLAINT_STATUSES, SLOT_HOLDING_STATUSES, TIME_SLOT_DEFINITIONS,
} from './appointments.dto';

const HOUR_MS = 60 * 60 * 1000;
/** Residents may cancel or reschedule a confirmed visit only up to this long before it starts. */
export const RESIDENT_CHANGE_CUTOFF_HOURS = 2;
/** Visits can be booked at most this many days ahead. */
export const MAX_BOOKING_HORIZON_DAYS = 60;
/** Workers may record arrival from this long before the slot starts. */
export const EARLY_ARRIVAL_WINDOW_HOURS = 1;
const UNAVAILABLE_WORKER_STATUSES = new Set<WorkerStatus>([WorkerStatus.OnLeave, WorkerStatus.Inactive]);

type Slot = { date: string; timeSlot: AppointmentTimeSlot };

/**
 * Appointments are visit schedules attached to existing complaints. Their status is independent
 * of the complaint status: no appointment action resolves or closes a complaint. Worker selection
 * reuses the complaint's worker assignment (ComplaintsService.assignWorker).
 *
 * Concurrency: persistence is the in-process in-memory repository used by every module. All
 * methods are synchronous, so each check-then-write runs to completion on the single Node.js
 * event loop and two requests cannot interleave between the conflict check and the save. This
 * does not hold across multiple server instances; a database-backed deployment needs a unique
 * constraint on (workerId, scheduledDate, scheduledTimeSlot) for slot-holding statuses.
 */
@Injectable()
export class AppointmentsService {
  private readonly crud = new CrudService(new CrudRepository<Appointment>([]), 'Appointment');
  constructor(private readonly complaints: ComplaintsService, private readonly workforce: WorkforceService) {}

  timeSlots() { return TIME_SLOT_DEFINITIONS; }

  listForActor(actor: AuthenticatedUser) {
    const visible = this.crud.findAll().filter((appointment) => this.canView(actor, appointment));
    return visible.map((appointment) => this.toViewModel(actor, appointment)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  findForActor(actor: AuthenticatedUser, id: string) {
    const appointment = this.crud.findById(id);
    this.assertCanView(actor, appointment);
    return this.toViewModel(actor, appointment);
  }

  /** Booked slots for a community worker; exposes no resident or complaint details. */
  workerSchedule(actor: AuthenticatedUser, workerId: string, date?: string) {
    if (actor.role !== RoleName.TowerRepresentative) throw new ForbiddenException('Only Tower Representatives may inspect worker schedules');
    const worker = this.workforce.findByIdForActor(actor, workerId);
    if (date) this.parseDate(date);
    const today = this.localDate(new Date());
    return {
      workerId: worker.id,
      workerName: worker.userName,
      status: worker.status,
      bookedSlots: this.crud.findAll()
        .filter((item) => item.workerId === worker.id && this.holdsSlot(item) && (date ? item.scheduledDate === date : item.scheduledDate! >= today))
        // Appointment ids are returned only for appointments the representative may open.
        .map((item) => ({ ...(this.canView(actor, item) ? { appointmentId: item.id } : {}), date: item.scheduledDate!, timeSlot: item.scheduledTimeSlot!, status: item.status }))
        .sort((a, b) => `${a.date}${a.timeSlot}`.localeCompare(`${b.date}${b.timeSlot}`)),
    };
  }

  request(actor: AuthenticatedUser, dto: CreateAppointmentDto) {
    if (actor.role !== RoleName.Resident) throw new ForbiddenException('Only residents may request appointments');
    const complaint = this.complaints.findById(dto.complaintId);
    if (complaint.residentId !== actor.id) throw new ForbiddenException('Residents may request appointments only for their own complaints');
    this.complaints.assertCanViewComplaint(actor, complaint);
    this.assertSchedulableComplaint(complaint);
    if (this.activeForComplaint(complaint.id)) throw new ConflictException('This complaint already has an active appointment');
    this.assertBookableSlot({ date: dto.preferredDate, timeSlot: dto.timeSlot }, complaint);
    const notes = this.optionalText(dto.notes);
    const now = new Date().toISOString();
    return this.toViewModel(actor, this.crud.create({
      complaintId: complaint.id, residentId: actor.id, communityId: complaint.communityId, towerId: complaint.towerId, apartmentId: complaint.apartmentId,
      status: AppointmentStatus.Requested, requestedDate: dto.preferredDate, requestedTimeSlot: dto.timeSlot,
      ...(notes ? { residentNotes: notes } : {}),
      history: [this.entry(actor, AppointmentAction.Requested, AppointmentStatus.Requested, now, { date: dto.preferredDate, timeSlot: dto.timeSlot, note: notes })],
      createdAt: now, updatedAt: now,
    }));
  }

  requestReschedule(actor: AuthenticatedUser, id: string, dto: RequestRescheduleDto) {
    const appointment = this.crud.findById(id);
    const complaint = this.assertResidentOwner(actor, appointment);
    const proposed = { date: dto.preferredDate, timeSlot: dto.timeSlot };
    const reason = this.requiredText(dto.reason, 'Reason');
    if (this.isActiveStatus(appointment)) this.assertSchedulableComplaint(complaint);
    const now = new Date().toISOString();
    if (appointment.status === AppointmentStatus.Requested) {
      if (this.sameSlot(proposed, { date: appointment.requestedDate, timeSlot: appointment.requestedTimeSlot })) throw new BadRequestException('Choose a different date or time slot');
      this.assertBookableSlot(proposed, complaint);
      return this.save(actor, appointment, {
        requestedDate: proposed.date, requestedTimeSlot: proposed.timeSlot, updatedAt: now,
        history: [...appointment.history, this.entry(actor, AppointmentAction.RequestUpdated, AppointmentStatus.Requested, now, { ...proposed, previousDate: appointment.requestedDate, previousTimeSlot: appointment.requestedTimeSlot, note: reason })],
      });
    }
    if (appointment.status !== AppointmentStatus.Confirmed) throw new BadRequestException(`A ${appointment.status} appointment cannot be rescheduled`);
    this.assertBeforeResidentCutoff(appointment, complaint);
    if (this.sameSlot(proposed, this.scheduledSlot(appointment))) throw new BadRequestException('Choose a different date or time slot');
    this.assertBookableSlot(proposed, complaint);
    return this.save(actor, appointment, {
      status: AppointmentStatus.RescheduleRequested, updatedAt: now,
      rescheduleRequest: { proposedDate: proposed.date, proposedTimeSlot: proposed.timeSlot, reason, requestedAt: now },
      history: [...appointment.history, this.entry(actor, AppointmentAction.RescheduleRequested, AppointmentStatus.RescheduleRequested, now, { ...proposed, previousDate: appointment.scheduledDate, previousTimeSlot: appointment.scheduledTimeSlot, note: reason })],
    });
  }

  cancel(actor: AuthenticatedUser, id: string, dto: CancelAppointmentDto) {
    const appointment = this.crud.findById(id);
    if (actor.role === RoleName.Resident) {
      const complaint = this.assertResidentOwner(actor, appointment);
      this.assertActive(appointment);
      if (appointment.status !== AppointmentStatus.Requested) this.assertBeforeResidentCutoff(appointment, complaint);
    } else if (actor.role === RoleName.TowerRepresentative) {
      this.assertAuthority(actor, appointment);
      this.assertActive(appointment);
    } else {
      throw new ForbiddenException('You may not cancel this appointment');
    }
    if (appointment.arrivedAt) throw new BadRequestException('The worker has already arrived; the visit outcome must be recorded instead');
    const reason = this.requiredText(dto.reason, 'Cancellation reason');
    const now = new Date().toISOString();
    return this.save(actor, appointment, {
      status: AppointmentStatus.Cancelled, rescheduleRequest: undefined, updatedAt: now,
      cancellation: { reason, cancelledAt: now, cancelledByRole: actor.role, cancelledByUserId: actor.id },
      history: [...appointment.history, this.entry(actor, AppointmentAction.Cancelled, AppointmentStatus.Cancelled, now, { note: reason })],
    });
  }

  confirm(actor: AuthenticatedUser, id: string, dto: ConfirmAppointmentDto) {
    const appointment = this.crud.findById(id);
    const complaint = this.assertAuthority(actor, appointment);
    if (appointment.status !== AppointmentStatus.Requested) throw new BadRequestException('Only REQUESTED appointments can be confirmed');
    if (complaint.status === ComplaintStatus.Submitted) throw new BadRequestException('Start the complaint review before confirming an appointment');
    this.assertSchedulableComplaint(complaint);
    const slot = { date: dto.scheduledDate ?? appointment.requestedDate, timeSlot: dto.timeSlot ?? appointment.requestedTimeSlot };
    this.assertBookableSlot(slot, complaint);
    const needsAssignment = !complaint.assignedWorkerId;
    if (!needsAssignment && complaint.assignedWorkerId !== dto.workerId) throw new BadRequestException('Appointments must use the worker assigned to the complaint');
    this.assertWorkerAvailable(this.workforce.assertValidAssignmentTarget(dto.workerId), complaint, slot, appointment.id);
    // Every appointment check has passed, so the existing assignment flow is the last step that can fail.
    if (needsAssignment) this.complaints.assignWorker(complaint.id, { workerId: dto.workerId }, actor);
    const now = new Date().toISOString();
    return this.save(actor, appointment, {
      status: AppointmentStatus.Confirmed, scheduledDate: slot.date, scheduledTimeSlot: slot.timeSlot, workerId: dto.workerId, confirmedAt: now, updatedAt: now,
      history: [...appointment.history, this.entry(actor, AppointmentAction.Confirmed, AppointmentStatus.Confirmed, now, { ...slot, workerId: dto.workerId, note: needsAssignment ? 'Worker assigned to the complaint' : undefined })],
    });
  }

  decideReschedule(actor: AuthenticatedUser, id: string, dto: RescheduleDecisionDto) {
    const appointment = this.crud.findById(id);
    const complaint = this.assertAuthority(actor, appointment);
    if (appointment.status !== AppointmentStatus.RescheduleRequested || !appointment.rescheduleRequest) throw new BadRequestException('This appointment has no pending reschedule request');
    const now = new Date().toISOString();
    const previous = this.scheduledSlot(appointment);
    const note = this.optionalText(dto.note);
    if (dto.decision === RescheduleDecision.Decline) {
      return this.save(actor, appointment, {
        status: AppointmentStatus.Confirmed, rescheduleRequest: undefined, updatedAt: now,
        history: [...appointment.history, this.entry(actor, AppointmentAction.RescheduleDeclined, AppointmentStatus.Confirmed, now, { ...previous, note })],
      });
    }
    this.assertSchedulableComplaint(complaint);
    const slot = { date: dto.scheduledDate ?? appointment.rescheduleRequest.proposedDate, timeSlot: dto.timeSlot ?? appointment.rescheduleRequest.proposedTimeSlot };
    this.assertBookableSlot(slot, complaint);
    this.assertWorkerAvailable(this.workforce.assertValidAssignmentTarget(appointment.workerId!), complaint, slot, appointment.id);
    return this.save(actor, appointment, {
      status: AppointmentStatus.Confirmed, scheduledDate: slot.date, scheduledTimeSlot: slot.timeSlot, rescheduleRequest: undefined, arrivedAt: undefined, updatedAt: now,
      history: [...appointment.history, this.entry(actor, AppointmentAction.RescheduleApproved, AppointmentStatus.Confirmed, now, { ...slot, previousDate: previous.date, previousTimeSlot: previous.timeSlot, workerId: appointment.workerId, note })],
    });
  }

  recordArrival(actor: AuthenticatedUser, id: string) {
    const appointment = this.crud.findById(id);
    this.assertAssignedWorker(actor, appointment);
    if (appointment.status !== AppointmentStatus.Confirmed) throw new BadRequestException('Arrival can be recorded only for CONFIRMED appointments');
    if (appointment.arrivedAt) throw new BadRequestException('Arrival has already been recorded');
    const { start } = this.slotWindow(this.scheduledSlot(appointment));
    const now = new Date();
    if (now.getTime() < start.getTime() - EARLY_ARRIVAL_WINDOW_HOURS * HOUR_MS) throw new BadRequestException(`Arrival can be recorded from ${EARLY_ARRIVAL_WINDOW_HOURS} hour before the scheduled slot`);
    if (this.localDate(now) > appointment.scheduledDate!) throw new BadRequestException('Arrival can be recorded only on the scheduled day');
    const at = now.toISOString();
    return this.save(actor, appointment, { arrivedAt: at, updatedAt: at, history: [...appointment.history, this.entry(actor, AppointmentAction.Arrived, AppointmentStatus.Confirmed, at)] });
  }

  recordOutcome(actor: AuthenticatedUser, id: string, dto: RecordOutcomeDto) {
    const appointment = this.crud.findById(id);
    const complaint = this.assertAssignedWorker(actor, appointment);
    if (appointment.status !== AppointmentStatus.Confirmed) throw new BadRequestException('An outcome can be recorded only for CONFIRMED appointments');
    const attachmentIds = [...new Set(dto.attachmentIds ?? [])];
    if (attachmentIds.length !== (dto.attachmentIds ?? []).length) throw new BadRequestException('Attachment references must be unique');
    if (dto.outcome === AppointmentOutcome.Completed) {
      if (!appointment.arrivedAt) throw new BadRequestException('Record your arrival before completing the appointment');
      const owned = complaint.attachments.filter((item) => attachmentIds.includes(item.id) && item.uploadedByRole === RoleName.MaintenanceWorker);
      if (owned.length !== attachmentIds.length) throw new BadRequestException('Photos must be worker-uploaded attachments of this complaint');
    } else {
      if (attachmentIds.length || dto.followUpRequired) throw new BadRequestException('Photos and follow-up apply only to completed appointments');
      this.assertSlotStarted(appointment);
    }
    const now = new Date().toISOString();
    const status = dto.outcome === AppointmentOutcome.Completed ? AppointmentStatus.Completed : AppointmentStatus.Missed;
    const notes = this.requiredText(dto.notes, 'Notes');
    // Appointment outcome only: the complaint lifecycle (resolve/verify) remains a separate workflow.
    return this.save(actor, appointment, {
      status, updatedAt: now,
      outcome: { outcome: dto.outcome, notes, followUpRequired: Boolean(dto.followUpRequired), attachmentIds, recordedAt: now, recordedByRole: actor.role },
      history: [...appointment.history, this.entry(actor, status === AppointmentStatus.Completed ? AppointmentAction.Completed : AppointmentAction.Missed, status, now, { note: notes })],
    });
  }

  markMissed(actor: AuthenticatedUser, id: string, dto: MarkMissedDto) {
    const appointment = this.crud.findById(id);
    this.assertAuthority(actor, appointment);
    if (appointment.status !== AppointmentStatus.Confirmed) throw new BadRequestException('Only CONFIRMED appointments can be marked as missed');
    if (appointment.arrivedAt) throw new BadRequestException('The worker has recorded arrival; the worker records the visit outcome');
    this.assertSlotStarted(appointment);
    const reason = this.requiredText(dto.reason, 'Reason');
    const now = new Date().toISOString();
    return this.save(actor, appointment, {
      status: AppointmentStatus.Missed, updatedAt: now,
      outcome: { outcome: AppointmentOutcome.Missed, notes: reason, followUpRequired: false, attachmentIds: [], recordedAt: now, recordedByRole: actor.role },
      history: [...appointment.history, this.entry(actor, AppointmentAction.Missed, AppointmentStatus.Missed, now, { note: reason })],
    });
  }

  private canView(actor: AuthenticatedUser, appointment: Appointment) {
    try { this.assertCanView(actor, appointment); return true; } catch { return false; }
  }
  private assertCanView(actor: AuthenticatedUser, appointment: Appointment) {
    const complaint = this.complaintFor(appointment);
    this.complaints.assertCanViewComplaint(actor, complaint);
    if (actor.role === RoleName.Resident && appointment.residentId === actor.id) return complaint;
    if (actor.role === RoleName.TowerRepresentative) return complaint;
    if (actor.role === RoleName.MaintenanceWorker && appointment.workerId === this.workerFor(actor).id) return complaint;
    throw new ForbiddenException('You do not have access to this appointment');
  }
  private assertResidentOwner(actor: AuthenticatedUser, appointment: Appointment) {
    if (actor.role !== RoleName.Resident || appointment.residentId !== actor.id) throw new ForbiddenException('Only the resident who requested this appointment may change it');
    const complaint = this.complaintFor(appointment);
    if (complaint.residentId !== actor.id) throw new ForbiddenException('Only the resident who requested this appointment may change it');
    return complaint;
  }
  private assertAuthority(actor: AuthenticatedUser, appointment: Appointment) {
    if (actor.role !== RoleName.TowerRepresentative) throw new ForbiddenException('Only the responsible Tower Representative may manage this appointment');
    const complaint = this.complaintFor(appointment);
    this.complaints.assertCanViewComplaint(actor, complaint);
    this.complaints.assertCanActAsAuthority(actor, complaint);
    return complaint;
  }
  private assertAssignedWorker(actor: AuthenticatedUser, appointment: Appointment) {
    const worker = this.workerFor(actor);
    const complaint = this.complaintFor(appointment);
    if (!appointment.workerId || appointment.workerId !== worker.id) throw new ForbiddenException('Only the worker assigned to this appointment may update it');
    if (worker.communityId !== complaint.communityId) throw new ForbiddenException('Workers may act only within their own community');
    this.complaints.assertCanViewComplaint(actor, complaint);
    return complaint;
  }
  private assertWorkerAvailable(worker: WorkerProfile, complaint: CommunityComplaint, slot: Slot, appointmentId: string) {
    if (worker.communityId !== complaint.communityId) throw new BadRequestException('Worker must belong to the complaint community');
    if (UNAVAILABLE_WORKER_STATUSES.has(worker.status)) throw new BadRequestException(`Worker is ${worker.status} and cannot be scheduled`);
    const clash = this.crud.findAll().find((item) => item.id !== appointmentId && item.workerId === worker.id && this.holdsSlot(item) && this.sameSlot(this.scheduledSlot(item), slot));
    if (clash) throw new ConflictException(`Worker already has a confirmed appointment on ${slot.date} at ${slot.timeSlot}`);
  }
  private assertSchedulableComplaint(complaint: CommunityComplaint) {
    if (complaint.type === ComplaintType.Community || complaint.responsibleRole !== RoleName.TowerRepresentative) throw new BadRequestException('Appointments are available only for apartment and tower complaints');
    if (!SCHEDULABLE_COMPLAINT_STATUSES.includes(complaint.status)) throw new BadRequestException(`Appointments cannot be scheduled for a ${complaint.status} complaint`);
  }
  /** A confirmed visit reserves its worker slot until it ends or its complaint is deleted. */
  private holdsSlot(appointment: Appointment) {
    if (!SLOT_HOLDING_STATUSES.includes(appointment.status) || !appointment.scheduledDate) return false;
    try { this.complaints.findById(appointment.complaintId); return true; } catch { return false; }
  }
  private isActiveStatus(appointment: Appointment) { return ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status); }
  private requiredText(value: string, field: string) {
    const text = value.trim();
    if (!text) throw new BadRequestException(`${field} must not be blank`);
    return text;
  }
  private optionalText(value?: string) { return value?.trim() || undefined; }
  private assertActive(appointment: Appointment) {
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status)) throw new BadRequestException(`A ${appointment.status} appointment cannot be changed`);
  }
  private assertBeforeResidentCutoff(appointment: Appointment, complaint: CommunityComplaint) {
    if (complaint.isEmergency) return; // Emergency visits stay changeable until they start.
    const { start } = this.slotWindow(this.scheduledSlot(appointment));
    if (start.getTime() - Date.now() < RESIDENT_CHANGE_CUTOFF_HOURS * HOUR_MS) throw new BadRequestException(`Confirmed appointments can be changed only up to ${RESIDENT_CHANGE_CUTOFF_HOURS} hours before the visit`);
  }
  private assertSlotStarted(appointment: Appointment) {
    if (this.slotWindow(this.scheduledSlot(appointment)).start.getTime() > Date.now()) throw new BadRequestException('An appointment can be marked as missed only after its slot has started');
  }
  /** Emergency complaints may also use the slot that is currently running, as long as it has not ended. */
  private assertBookableSlot(slot: Slot, complaint: CommunityComplaint) {
    const { start, end } = this.slotWindow(slot);
    const now = Date.now();
    if (complaint.isEmergency ? end.getTime() <= now : start.getTime() <= now) throw new BadRequestException(complaint.isEmergency ? 'Choose a time slot that has not ended yet' : 'Choose a time slot that has not started yet');
    if (start.getTime() - now > MAX_BOOKING_HORIZON_DAYS * 24 * HOUR_MS) throw new BadRequestException(`Appointments can be booked up to ${MAX_BOOKING_HORIZON_DAYS} days ahead`);
  }
  /** Slots are interpreted in the server's local time zone. */
  private slotWindow(slot: Slot) {
    const definition = TIME_SLOT_DEFINITIONS.find((item) => item.code === slot.timeSlot);
    if (!definition) throw new BadRequestException('Unknown time slot');
    const day = this.parseDate(slot.date);
    const at = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes); };
    return { start: at(definition.start), end: at(definition.end) };
  }
  private parseDate(value: string) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (!year || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new BadRequestException('Date is not a valid calendar date');
    return date;
  }
  private localDate(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  private sameSlot(a: Partial<Slot>, b: Partial<Slot>) { return Boolean(a.date) && a.date === b.date && a.timeSlot === b.timeSlot; }
  private scheduledSlot(appointment: Appointment): Slot { return { date: appointment.scheduledDate!, timeSlot: appointment.scheduledTimeSlot! }; }
  private activeForComplaint(complaintId: string) { return this.crud.findAll().find((item) => item.complaintId === complaintId && ACTIVE_APPOINTMENT_STATUSES.includes(item.status)); }
  private complaintFor(appointment: Appointment) {
    try { return this.complaints.findById(appointment.complaintId); } catch { throw new NotFoundException('The complaint for this appointment no longer exists'); }
  }
  private workerFor(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.MaintenanceWorker) throw new ForbiddenException('Only Maintenance Workers have worker profiles');
    return this.workforce.getWorkerProfileForUser(actor.id);
  }
  private entry(actor: AuthenticatedUser, action: AppointmentAction, status: AppointmentStatus, changedAt: string, details: Omit<Partial<AppointmentHistoryEntry>, 'action' | 'status' | 'changedAt'> = {}): AppointmentHistoryEntry {
    const defined = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined && value !== ''));
    return { action, status, changedAt, changedByRole: actor.role, changedByUserId: actor.id, ...defined };
  }
  private save(actor: AuthenticatedUser, appointment: Appointment, changes: Partial<Appointment>) {
    return this.toViewModel(actor, this.crud.update(appointment.id, changes));
  }
  private toViewModel(actor: AuthenticatedUser, appointment: Appointment) {
    const complaint = this.complaints.findByIdForActor(actor, appointment.complaintId);
    return {
      ...appointment,
      ...(appointment.workerId ? { workerName: this.workforce.getWorkerName(appointment.workerId) } : {}),
      complaint: {
        id: complaint.id, title: complaint.title, isEmergency: Boolean(complaint.isEmergency), description: complaint.description, type: complaint.type, status: complaint.status,
        requiredWorkType: complaint.requiredWorkType, assignedWorkerId: complaint.assignedWorkerId, location: complaint.location,
        responsibleUserId: complaint.responsibleUserId, responsibleUserName: complaint.responsibleUserName,
      },
    };
  }
}
