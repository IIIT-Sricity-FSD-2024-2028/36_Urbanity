import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { ComplaintsService } from '../complaints/complaints.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { WorkforceService } from '../workforce/workforce.service';
import { WorkerStatus } from '../workforce/workforce.dto';
import { AssignServiceWorkerDto, CatalogueEntry, CompleteServiceDto, CreateCatalogueDto, CreateServiceRequestDto, DecideEstimateDto, EstimateDecision, PaidServiceRequest, PaymentEvidence, ReportServicePaymentDto, ReviewFinalCostDto, ReviewServiceDto, ScheduleServiceDto, ServiceStatus, SubmitEstimateDto, UpdateCatalogueDto, VerifyServicePaymentDto } from './paid-services.dto';

const now = () => new Date().toISOString();

@Injectable()
export class PaidServicesService {
  private readonly catalogue = new CrudService(new CrudRepository<CatalogueEntry>(), 'Service');
  private readonly requests = new CrudService(new CrudRepository<PaidServiceRequest>(), 'Service request');
  constructor(
    @Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>,
    private readonly community: CommunityService,
    private readonly workforce: WorkforceService,
    private readonly complaints: ComplaintsService,
    private readonly subscriptions: SubscriptionService,
  ) {
    this.community.registerOccupancyBlocker?.('paid-services', (apartmentId) => this.requests.findAll().some(r=>r.apartmentId===apartmentId&&r.status!=='CANCELLED'&&!r.completedAt) ? 'Complete or explicitly cancel unfinished paid services before activating tenancy; financial records remain unchanged' : undefined);
  }

  listCatalogue(actor: AuthenticatedUser) {
    if(actor.role===RoleName.Resident)this.community.resolveResidentOccupancy(actor.id);
    const communityId = this.actorCommunity(actor);
    return this.catalogue.findAll().filter((item) => item.communityId === communityId && (actor.role === RoleName.CommunityAdmin || item.active));
  }
  createCatalogue(actor: AuthenticatedUser, dto: CreateCatalogueDto) {
    this.requireRole(actor, RoleName.CommunityAdmin);
    const communityId = this.actorCommunity(actor);
    this.subscriptions.assertCommunityActive(communityId);
    this.uniqueName(communityId, dto.name);
    const at = now();
    return this.catalogue.create({ ...dto, name: dto.name.trim(), description: dto.description.trim(), communityId, createdAt: at, updatedAt: at });
  }
  updateCatalogue(actor: AuthenticatedUser, id: string, dto: UpdateCatalogueDto) {
    this.requireRole(actor, RoleName.CommunityAdmin);
    const entry = this.catalogue.findById(id);
    if (entry.communityId !== this.actorCommunity(actor)) throw new ForbiddenException('Service belongs to another community');
    this.subscriptions.assertCommunityActive(entry.communityId);
    if (!Object.keys(dto).length || Object.values(dto).some((value) => value === null)) throw new BadRequestException('Provide valid service fields');
    if (dto.name) this.uniqueName(entry.communityId, dto.name, id);
    return this.catalogue.update(id, { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}), ...(dto.description ? { description: dto.description.trim() } : {}), updatedAt: now() });
  }
  createRequest(actor: AuthenticatedUser, dto: CreateServiceRequestDto) {
    this.requireRole(actor, RoleName.Resident);
    const previous = this.requests.findAll().find((item) => item.residentId === actor.id && item.clientRequestId === dto.clientRequestId);
    if (previous) {
      if (previous.service.catalogueId !== dto.catalogueId || previous.description !== dto.description.trim()) throw new ConflictException('This submission key was already used for a different request');
      return this.view(previous);
    }
    const location = this.community.resolveResidentOccupancy(actor.id);
    this.community.assertServiceOccupancy(actor.id,location.apartment.id);
    const entry = this.catalogue.findById(dto.catalogueId);
    if (entry.communityId !== location.community.id || !entry.active) throw new BadRequestException('Select an active service in your community');
    this.subscriptions.assertCommunityActive(location.community.id);
    const at = now();
    const item = this.requests.create({
      clientRequestId: dto.clientRequestId, residentId: actor.id, communityId: location.community.id,
      towerId: location.tower.id, apartmentId: location.apartment.id,
      location: { communityName: location.community.name, towerName: location.tower.name, floorLabel: location.floor.label || String(location.floor.floorNumber), apartmentNumber: location.apartment.apartmentNumber },
      service: { catalogueId: entry.id, name: entry.name, specialization: entry.specialization, startingPricePaise: entry.startingPricePaise },
      description: dto.description.trim(), status: 'REQUESTED', version: 1, estimates: [], evidence: [],
      history: [{ status: 'REQUESTED', actorId: actor.id, at, note: 'Service requested' }], createdAt: at, updatedAt: at,
    });
    return this.view(item);
  }
  list(actor: AuthenticatedUser) { return this.requests.findAll().filter((item) => this.canView(actor, item)).map((item) => this.view(item)); }
  get(actor: AuthenticatedUser, id: string) { return this.view(this.access(actor, id)); }
  eligibleWorkers(actor: AuthenticatedUser, id: string) {
    const item = this.access(actor, id); this.authority(actor, item);
    return this.workforce.findAll().filter((worker) => worker.communityId === item.communityId && worker.specialization === item.service.specialization && worker.status === WorkerStatus.Available && !this.workforce.hasPaidServiceReservation(worker.id) && !this.complaints.hasActiveAssignment(worker.id))
      .filter((worker) => { try { this.workforce.assertValidAssignmentTarget(worker.id); return true; } catch { return false; } })
      .map((worker) => this.workforce.toViewModel(worker));
  }
  assign(actor: AuthenticatedUser, id: string, dto: AssignServiceWorkerDto) {
    const item = this.mutation(actor, id, dto.version); this.authority(actor, item); this.status(item, 'REQUESTED');
    const worker = this.workforce.assertValidAssignmentTarget(dto.workerId);
    if (worker.communityId !== item.communityId || worker.specialization !== item.service.specialization || worker.status !== WorkerStatus.Available || this.complaints.hasActiveAssignment(worker.id)) throw new BadRequestException('Worker must be available, qualified, and in this community');
    this.workforce.reservePaidService(worker.id, item.id);
    item.workerId = worker.id;
    return this.change(item, actor, 'ASSIGNED', 'Worker assigned');
  }
  submitEstimate(actor: AuthenticatedUser, id: string, dto: SubmitEstimateDto) {
    const item = this.mutation(actor, id, dto.version); this.worker(actor, item);
    this.status(item, 'ASSIGNED', 'ESTIMATE_REJECTED', 'REVISION_REQUESTED', 'ESTIMATE_APPROVED', 'SCHEDULED', 'IN_PROGRESS');
    item.estimates.push({ id: randomUUID(), number: item.estimates.length + 1, amountPaise: dto.amountPaise, description: dto.description.trim(), status: 'PENDING', submittedAt: now() });
    return this.change(item, actor, 'AWAITING_ESTIMATE_APPROVAL', item.startedAt ? 'Work paused for revised estimate approval' : 'Estimate submitted');
  }
  decideEstimate(actor: AuthenticatedUser, id: string, dto: DecideEstimateDto) {
    const item = this.mutation(actor, id, dto.version); this.owner(actor, item); this.status(item, 'AWAITING_ESTIMATE_APPROVAL');
    const estimate = item.estimates.at(-1)!;
    if (estimate.id !== dto.estimateId || estimate.status !== 'PENDING') throw new ConflictException('This estimate is no longer awaiting approval');
    if (dto.decision !== EstimateDecision.Approve && !dto.note?.trim()) throw new BadRequestException('Explain the rejection or requested revision');
    estimate.decidedAt = now(); estimate.decisionNote = dto.note?.trim();
    if (dto.decision === EstimateDecision.Approve) {
      estimate.status = 'APPROVED'; item.approvedEstimateId = estimate.id;
      // Any revised total replaces the previous ceiling; pending/rejected revisions block all work.
      return this.change(item, actor, item.startedAt ? 'IN_PROGRESS' : item.appointment ? 'SCHEDULED' : 'ESTIMATE_APPROVED', 'Resident approved estimate');
    }
    estimate.status = dto.decision === EstimateDecision.Reject ? 'REJECTED' : 'REVISION_REQUESTED';
    return this.change(item, actor, dto.decision === EstimateDecision.Reject ? 'ESTIMATE_REJECTED' : 'REVISION_REQUESTED', dto.note!.trim());
  }
  schedule(actor: AuthenticatedUser, id: string, dto: ScheduleServiceDto) {
    const item = this.mutation(actor, id, dto.version);
    if (actor.role === RoleName.Resident) this.owner(actor, item); else this.authority(actor, item);
    this.status(item, 'ESTIMATE_APPROVED', 'SCHEDULED');
    this.approvedEstimate(item);
    this.community.resolveResidentOccupancy(item.residentId,item.apartmentId,dto.startsAt,dto.endsAt);
    const start = Date.parse(dto.startsAt), end = Date.parse(dto.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() || end <= start || end - start > 8 * 60 * 60 * 1000) throw new BadRequestException('Choose a future appointment lasting at most 8 hours');
    const conflict = this.requests.findAll().some((other) => other.id !== item.id && other.status !== 'CANCELLED' && other.appointment && (other.workerId === item.workerId || other.residentId === item.residentId) && start < Date.parse(other.appointment.endsAt) && end > Date.parse(other.appointment.startsAt));
    if (conflict) throw new ConflictException('The worker or resident already has an overlapping appointment');
    item.appointment = { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() };
    return this.change(item, actor, 'SCHEDULED', 'Appointment scheduled');
  }
  start(actor: AuthenticatedUser, id: string, version: number) {
    const item = this.mutation(actor, id, version); this.worker(actor, item); this.status(item, 'SCHEDULED'); this.approvedEstimate(item);
    if (!item.appointment || Date.now() < Date.parse(item.appointment.startsAt) || Date.now() >= Date.parse(item.appointment.endsAt)) throw new BadRequestException('Start work within the scheduled appointment; reschedule an expired appointment');
    this.community.resolveResidentOccupancy(item.residentId,item.apartmentId);
    item.startedAt = now();
    return this.change(item, actor, 'IN_PROGRESS', 'Work started');
  }
  complete(actor: AuthenticatedUser, id: string, dto: CompleteServiceDto) {
    const item = this.mutation(actor, id, dto.version); this.worker(actor, item); this.status(item, 'IN_PROGRESS', 'FINAL_COST_REJECTED');
    const estimate = this.approvedEstimate(item);
    if (dto.finalCostPaise > estimate.amountPaise) throw new BadRequestException('Final cost exceeds the approved estimate; obtain approval of a revised estimate first');
    if (!item.completedAt) this.workforce.releasePaidService(item.workerId!, item.id);
    item.completionReport = dto.completionReport.trim(); item.finalCostPaise = dto.finalCostPaise; item.completedAt = now();
    return this.change(item, actor, 'COMPLETED', 'Completion and final cost submitted');
  }
  progress(actor: AuthenticatedUser, id: string, version: number, note: string) {
    const item = this.mutation(actor, id, version); this.worker(actor, item); this.status(item, 'IN_PROGRESS'); this.approvedEstimate(item);
    return this.change(item, actor, item.status, `Work update: ${note.trim()}`);
  }
  reviewFinalCost(actor: AuthenticatedUser, id: string, dto: ReviewFinalCostDto) {
    const item = this.mutation(actor, id, dto.version); this.authority(actor, item); this.status(item, 'COMPLETED');
    const estimate = this.approvedEstimate(item);
    if (!item.completedAt || !item.finalCostPaise || item.finalCostPaise > estimate.amountPaise) throw new BadRequestException('Final cost requires a completed service within the approved estimate');
    item.finalReview = { approved: dto.approved, note: dto.note.trim(), reviewedBy: actor.id, reviewedAt: now(), estimateId: estimate.id };
    return this.change(item, actor, dto.approved ? 'FINAL_COST_APPROVED' : 'FINAL_COST_REJECTED', dto.note.trim());
  }
  approvePayment(actor: AuthenticatedUser, id: string, version: number) {
    const item = this.mutation(actor, id, version); this.authority(actor, item); this.status(item, 'FINAL_COST_APPROVED');
    if (item.payment) throw new ConflictException('A payment record already exists for this service');
    const estimate = this.approvedEstimate(item);
    if (!item.finalReview?.approved || item.finalReview.estimateId !== estimate.id || !item.finalCostPaise || item.finalCostPaise > estimate.amountPaise) throw new BadRequestException('An authorized final cost is required');
    const worker = this.workforce.findById(item.workerId!);
    const payee = this.users.findById(worker.userId);
    if (payee.role !== RoleName.MaintenanceWorker || payee.communityId !== item.communityId || worker.communityId !== item.communityId) throw new BadRequestException('Assigned worker payee must still belong to this community');
    item.payment = { id: randomUUID(), requestId: item.id, workerId: worker.id, payeeUserId: payee.id, amountPaise: item.finalCostPaise, currency: 'INR', status: 'APPROVED', approvedBy: actor.id, approvedAt: now() };
    return this.change(item, actor, item.status, 'Worker payment authorized; no funds transferred');
  }
  addEvidence(actor: AuthenticatedUser, id: string, evidence: PaymentEvidence) {
    const item = this.access(actor, id); this.owner(actor, item);
    if (!item.payment || item.payment.status !== 'APPROVED') throw new BadRequestException('Payment evidence can be uploaded after payment authorization and before reporting');
    if (item.evidence.length >= 5) throw new BadRequestException('At most five payment evidence images are allowed');
    item.evidence.push(evidence);
    return this.change(item, actor, item.status, 'Payment evidence uploaded');
  }
  evidence(actor: AuthenticatedUser, id: string, evidenceId: string) {
    const item = this.access(actor, id);
    const evidence = item.evidence.find((entry) => entry.id === evidenceId);
    if (!evidence) throw new BadRequestException('Payment evidence not found');
    return evidence;
  }
  reportPayment(actor: AuthenticatedUser, id: string, dto: ReportServicePaymentDto) {
    const item = this.mutation(actor, id, dto.version); this.owner(actor, item);
    const payment = item.payment;
    if (!payment || payment.status !== 'APPROVED') throw new BadRequestException('Payment must be authorized and not already reported');
    if (!item.evidence.some((entry) => entry.id === dto.evidenceId)) throw new BadRequestException('Upload payment evidence for this request');
    if (this.requests.findAll().some((other) => other.payment?.reference?.toLowerCase() === dto.reference.trim().toLowerCase())) throw new ConflictException('This payment reference has already been reported');
    Object.assign(payment, { status: 'PAYMENT_REPORTED', reference: dto.reference.trim(), evidenceId: dto.evidenceId, reportedAt: now() });
    return this.change(item, actor, item.status, 'Resident reported an external payment; verification pending');
  }
  verifyPayment(actor: AuthenticatedUser, id: string, dto: VerifyServicePaymentDto) {
    const item = this.mutation(actor, id, dto.version); this.authority(actor, item);
    if (item.payment?.status !== 'PAYMENT_REPORTED') throw new BadRequestException('Only reported payment evidence can be verified');
    if (!dto.approved) {
      const reference = item.payment.reference;
      Object.assign(item.payment, { status: 'APPROVED', reference: undefined, evidenceId: undefined, reportedAt: undefined });
      return this.change(item, actor, item.status, `Payment evidence rejected for reference ${reference}: ${dto.verificationNote.trim()}`);
    }
    Object.assign(item.payment, { status: 'EVIDENCE_VERIFIED', verifiedBy: actor.id, verifiedAt: now(), verificationNote: dto.verificationNote.trim() });
    return this.change(item, actor, item.status, 'Authority manually verified payment evidence; worker receipt pending');
  }
  confirmReceipt(actor: AuthenticatedUser, id: string, version: number) {
    const item = this.mutation(actor, id, version); this.worker(actor, item);
    if (item.payment?.status !== 'EVIDENCE_VERIFIED' || item.payment.payeeUserId !== actor.id) throw new BadRequestException('Only the intended worker payee may confirm a verified payment receipt');
    item.payment.status = 'RECEIPT_CONFIRMED'; item.payment.receiptConfirmedAt = now();
    return this.change(item, actor, item.status, 'Worker manually acknowledged receipt; no gateway verification');
  }
  review(actor: AuthenticatedUser, id: string, dto: ReviewServiceDto) {
    const item = this.mutation(actor, id, dto.version); this.owner(actor, item); this.status(item, 'FINAL_COST_APPROVED');
    if (item.review) throw new ConflictException('This service already has a resident review');
    item.review = { rating: dto.rating, feedback: dto.feedback.trim(), createdAt: now() };
    return this.change(item, actor, item.status, 'Resident reviewed service');
  }
  cancel(actor: AuthenticatedUser, id: string, version: number) {
    const item = this.mutation(actor, id, version);
    if (actor.role === RoleName.Resident) this.owner(actor, item); else this.authority(actor, item);
    if (item.startedAt || item.status === 'CANCELLED' || item.payment) throw new BadRequestException('Only requests whose work has not started can be cancelled');
    if (item.workerId) this.workforce.releasePaidService(item.workerId, item.id);
    return this.change(item, actor, 'CANCELLED', 'Service cancelled before work began');
  }

  private actorCommunity(actor: AuthenticatedUser) {
    const user = this.users.findById(actor.id);
    if (user.communityId) return user.communityId;
    if (user.towerId) return this.community.getTower(user.towerId).communityId;
    if (user.apartmentId) return this.community.resolveResidentHierarchy(actor.id).community.id;
    throw new ForbiddenException('A community association is required');
  }
  private canView(actor: AuthenticatedUser, item: PaidServiceRequest) {
    if (this.actorCommunity(actor) !== item.communityId) return false;
    if (actor.role === RoleName.CommunityAdmin) return true;
    if (actor.role === RoleName.TowerRepresentative) return this.users.findById(actor.id).towerId === item.towerId;
    if (actor.role === RoleName.Resident) return actor.id === item.residentId;
    if (actor.role === RoleName.MaintenanceWorker) return this.workforce.getWorkerProfileForUser(actor.id).id === item.workerId;
    return false;
  }
  private access(actor: AuthenticatedUser, id: string) {
    const item = this.requests.findById(id);
    if (!this.canView(actor, item)) throw new ForbiddenException('You do not have access to this service request');
    return item;
  }
  private mutation(actor: AuthenticatedUser, id: string, version: number) {
    const item = this.access(actor, id);
    if (item.version !== version) throw new ConflictException('This request changed. Refresh it before trying again');
    return item;
  }
  private requireRole(actor: AuthenticatedUser, role: RoleName) { if (actor.role !== role) throw new ForbiddenException(`This action requires ${role}`); }
  private owner(actor: AuthenticatedUser, item: PaidServiceRequest) { this.requireRole(actor, RoleName.Resident); if (actor.id !== item.residentId) throw new ForbiddenException('Only the requesting resident may do this'); }
  private authority(actor: AuthenticatedUser, item: PaidServiceRequest) {
    if (![RoleName.CommunityAdmin, RoleName.TowerRepresentative].includes(actor.role) || !this.canView(actor, item)) throw new ForbiddenException('A Community Admin or the tower representative must authorize this action');
  }
  private worker(actor: AuthenticatedUser, item: PaidServiceRequest) {
    this.requireRole(actor, RoleName.MaintenanceWorker);
    const worker = this.workforce.getWorkerProfileForUser(actor.id);
    if (item.workerId !== worker.id || worker.communityId !== item.communityId) throw new ForbiddenException('Only the assigned maintenance worker may do this');
  }
  private status(item: PaidServiceRequest, ...allowed: ServiceStatus[]) { if (!allowed.includes(item.status)) throw new BadRequestException(`This action is not allowed while service is ${item.status}`); }
  private approvedEstimate(item: PaidServiceRequest) {
    const estimate = item.estimates.at(-1);
    if (!estimate || estimate.id !== item.approvedEstimateId || estimate.status !== 'APPROVED') throw new BadRequestException('The latest estimate requires resident approval');
    return estimate;
  }
  private uniqueName(communityId: string, name: string, excludedId?: string) {
    if (this.catalogue.findAll().some((entry) => entry.communityId === communityId && entry.id !== excludedId && entry.name.toLowerCase() === name.trim().toLowerCase())) throw new ConflictException('A service with this name already exists');
  }
  private change(item: PaidServiceRequest, actor: AuthenticatedUser, status: ServiceStatus, note: string) {
    item.status = status; item.version += 1; item.updatedAt = now();
    item.history.push({ status, actorId: actor.id, at: item.updatedAt, note });
    return this.view(item);
  }
  private view(item: PaidServiceRequest) {
    // Keep historical service records usable if a user is later removed.
    const worker = this.workforce.findAll().find((entry) => entry.id === item.workerId);
    const workerUser = worker && this.users.findAll().find((entry) => entry.id === worker.userId);
    const resident = this.users.findAll().find((entry) => entry.id === item.residentId);
    return structuredClone({ ...item, workerName: workerUser?.name, residentName: resident?.name, evidence: item.evidence.map(({ storedName: _storedName, ...entry }) => entry) });
  }
}
