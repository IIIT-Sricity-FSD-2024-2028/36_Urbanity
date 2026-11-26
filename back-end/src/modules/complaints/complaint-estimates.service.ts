import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { ComplaintStatus } from '../../common/enums/status.enum';
import type { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { WorkforceService } from '../workforce/workforce.service';
import { AdminEstimateDecisionDto, ComplaintEstimate, EstimateAuditEvent, EstimateStatus, MAX_ESTIMATE_PAISE, MockWorkerPayment, SubmitComplaintEstimateDto, TowerEstimateDecisionDto } from './complaint-estimates.dto';
import { CommunityComplaint, ComplaintType } from './complaints.dto';
import { ComplaintsService } from './complaints.service';

const REVISABLE: ReadonlySet<EstimateStatus> = new Set(['RETURNED_FOR_REVISION', 'REJECTED_BY_TOWER', 'REJECTED_BY_ADMIN', 'CANCELLED']);
const TOWER_OUTCOMES = {
  APPROVE: 'PENDING_COMMUNITY_ADMIN_APPROVAL',
  REJECT: 'REJECTED_BY_TOWER',
  RETURN: 'RETURNED_FOR_REVISION',
} as const;

@Injectable()
export class ComplaintEstimatesService {
  constructor(
    private readonly complaints: ComplaintsService,
    private readonly workforce: WorkforceService,
    @Inject(serviceToken('users')) private readonly users: Pick<CrudService<User, Partial<User>, Partial<User>>, 'findById' | 'findAll'>,
  ) {}

  get(actor: AuthenticatedUser, id: string) {
    if (actor.role === RoleName.SuperAdmin) throw new ForbiddenException('Estimate records are available to complaint participants');
    const complaint = this.complaints.findByIdForActor(actor, id);
    if (complaint.type === ComplaintType.Community) return { available: false as const };

    const workflow = this.complaints.estimateWorkflows.get(id);
    const visibleRevisions = workflow?.revisions.filter((revision) =>
      actor.role !== RoleName.CommunityAdmin || revision.audit.some((event) => event.action === 'TOWER_APPROVE'));
    const latest = visibleRevisions?.at(-1);
    const isEstimateSubmitter = latest?.audit[0].actorId === actor.id;
    const assigned = Boolean(complaint.assignedWorkerId);
    const status = latest?.status ?? (assigned && complaint.status === ComplaintStatus.Assigned ? 'AWAITING_WORKER_ESTIMATE' : null);
    if (actor.role === RoleName.Resident) {
      return { available: true as const, assigned, status };
    }
    if (actor.role === RoleName.CommunityAdmin && !latest) {
      return { available: false as const };
    }

    const eligible = this.complaints.isCurrentPayeeEligible(complaint);
    const canSubmit = actor.role === RoleName.MaintenanceWorker && eligible && complaint.status === ComplaintStatus.Assigned
      && (!latest || REVISABLE.has(latest.status));
    const canReview = actor.role === RoleName.TowerRepresentative && complaint.responsibleUserId === actor.id && !isEstimateSubmitter
      && status === 'PENDING_TOWER_VERIFICATION';
    return {
      available: true as const, assigned, status, canSubmit, canReview,
      canStartWork: actor.role === RoleName.MaintenanceWorker && eligible && complaint.status === ComplaintStatus.Assigned && this.complaints.canStartRepair(complaint),
      canCancel: actor.role === RoleName.TowerRepresentative && complaint.responsibleUserId === actor.id && !isEstimateSubmitter
        && complaint.status === ComplaintStatus.Assigned && !eligible && latest?.status !== 'PAID' && latest?.status !== 'CANCELLED' && Boolean(latest),
      estimate: actor.role === RoleName.MaintenanceWorker && latest?.status === 'CANCELLED' ? undefined : latest,
      ...(canSubmit && latest ? { previousEstimateId: latest.id } : {}),
      payment: workflow?.payment,
      paymentStatus: workflow?.payment?.status ?? 'NOT_PAID',
      complaint: {
        id, title: complaint.title, description: complaint.description, status: complaint.status,
        requiredWorkType: complaint.requiredWorkType, location: complaint.location, workerName: complaint.assignedWorkerName,
        ...(actor.role === RoleName.CommunityAdmin ? {
          residentName: this.users.findAll().find((user) => user.id === complaint.residentId)?.name,
        } : {}),
      },
      ...(actor.role === RoleName.CommunityAdmin || actor.role === RoleName.TowerRepresentative ? {
        isEstimateSubmitter,
        assignment: this.complaints.assignmentForComplaint(id)?.assignmentAudit,
        assignmentHistory: this.complaints.assignmentHistory(id),
        history: visibleRevisions,
      } : {}),
      ...(actor.role === RoleName.CommunityAdmin ? {
        canApprovePayment: !isEstimateSubmitter && !latest?.audit.some((event) => event.action === 'TOWER_APPROVE' && event.actorId === actor.id),
      } : {}),
    };
  }

  list(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.TowerRepresentative && actor.role !== RoleName.CommunityAdmin) {
      throw new ForbiddenException('Only complaint authorities can access estimate queues');
    }
    return this.complaints.findAllForActor(actor, new Set(this.complaints.estimateWorkflows.keys()))
      .map(({ id }) => this.get(actor, id))
      .flatMap((record) => 'estimate' in record && record.estimate
        && (actor.role === RoleName.CommunityAdmin || record.canReview) ? [{ ...record, estimate: record.estimate }] : [])
      .sort((left, right) => right.estimate.submittedAt.localeCompare(left.estimate.submittedAt));
  }

  submit(actor: AuthenticatedUser, id: string, dto: SubmitComplaintEstimateDto) {
    const complaint = this.requireTowerComplaint(actor, id);
    const workerId = this.complaints.assertCanEstimate(actor, complaint);
    const revisions = this.complaints.estimateWorkflows.get(id)?.revisions ?? [];
    const previous = revisions.at(-1);
    if (previous && !REVISABLE.has(previous.status)) throw new ConflictException('This estimate is already under review, approved, or paid');
    if (dto.previousEstimateId !== previous?.id) throw new ConflictException('The estimate has changed. Refresh before submitting a revision');
    if (complaint.status !== ComplaintStatus.Assigned || !this.complaints.isCurrentPayeeEligible(complaint)) {
      throw new ConflictException('An available worker assignment is required before repair starts');
    }

    const costs = dto.costs.map(({ category, description, quantity, unitPricePaise }) => {
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000
        || !Number.isSafeInteger(unitPricePaise) || unitPricePaise < 0 || unitPricePaise > MAX_ESTIMATE_PAISE) {
        throw new BadRequestException('Each cost must have a valid quantity and a non-negative price in paise');
      }
      return { category, description, quantity, unitPricePaise, subtotalPaise: quantity * unitPricePaise };
    });
    const totalPaise = costs.reduce((total, entry) => total + entry.subtotalPaise, 0);
    if (!Number.isSafeInteger(totalPaise) || totalPaise > MAX_ESTIMATE_PAISE) {
      throw new BadRequestException('The total estimate must be at most INR 10,000,000');
    }

    const estimateId = randomUUID();
    const submittedAt = new Date().toISOString();
    const status = 'PENDING_TOWER_VERIFICATION';
    const audit = this.event(actor, {
      action: 'SUBMIT_ESTIMATE', complaintId: id, estimateId, previousStatus: previous?.status ?? 'AWAITING_WORKER_ESTIMATE',
      newStatus: status, timestamp: submittedAt,
    });
    const { inspection, proposedResolution, notes, completionHours } = dto;
    const estimate: ComplaintEstimate = {
      id: estimateId, workerId, inspection, proposedResolution, notes, completionHours, costs, totalPaise, submittedAt, status, audit: [audit],
    };
    this.complaints.estimateWorkflows.set(id, { revisions: [...revisions, estimate] });
    return this.get(actor, id);
  }

  decideAsTower(actor: AuthenticatedUser, id: string, estimateId: string, dto: TowerEstimateDecisionDto) {
    this.requireRole(actor, RoleName.TowerRepresentative);
    const complaint = this.requireTowerComplaint(actor, id);
    this.complaints.assertCanActAsAuthority(actor, complaint);
    const estimate = this.requireCurrent(id, estimateId, 'PENDING_TOWER_VERIFICATION');
    this.assertOtherActor(actor, estimate);
    return this.recordDecision(actor, id, estimateId, TOWER_OUTCOMES[dto.decision], `TOWER_${dto.decision}`, dto.reason);
  }

  decideAsAdmin(actor: AuthenticatedUser, id: string, estimateId: string, dto: AdminEstimateDecisionDto) {
    this.assertAdmin(actor, id);
    const estimate = this.requireCurrent(id, estimateId, 'PENDING_COMMUNITY_ADMIN_APPROVAL');
    this.assertOtherActor(actor, estimate);
    if (dto.decision === 'APPROVE' && estimate.audit.some((event) => event.action === 'TOWER_APPROVE' && event.actorId === actor.id)) {
      throw new ForbiddenException('Payment approval requires a different actor from tower verification');
    }
    const status = dto.decision === 'APPROVE' ? 'APPROVED_FOR_PAYMENT' : 'REJECTED_BY_ADMIN';
    return this.recordDecision(actor, id, estimateId, status, `ADMIN_${dto.decision}`, dto.reason);
  }

  cancel(actor: AuthenticatedUser, id: string, estimateId: string, reason: string) {
    this.requireRole(actor, RoleName.TowerRepresentative);
    const complaint = this.requireTowerComplaint(actor, id);
    this.complaints.assertCanActAsAuthority(actor, complaint);
    const workflow = this.complaints.estimateWorkflows.get(id);
    const estimate = workflow?.revisions.at(-1);
    if (!workflow || !estimate || estimate.id !== estimateId || workflow.payment || estimate.status === 'CANCELLED' || estimate.status === 'PAID') {
      throw new ConflictException('Only the current unpaid estimate can be cancelled');
    }
    this.assertOtherActor(actor, estimate);
    if (!reason?.trim()) throw new BadRequestException('Provide a cancellation reason');
    if (this.complaints.isCurrentPayeeEligible(complaint)) throw new ConflictException('The currently assigned worker is still available');
    const timestamp = new Date().toISOString();
    const event = this.event(actor, {
      action: 'CANCEL_ESTIMATE', complaintId: id, estimateId, previousStatus: estimate.status,
      newStatus: 'CANCELLED', timestamp, reason: reason.trim(),
    });
    this.complaints.cancelUnstartedAssignment(complaint, actor, timestamp, reason.trim());
    this.complaints.estimateWorkflows.set(id, {
      revisions: [...workflow.revisions.slice(0, -1), { ...estimate, status: 'CANCELLED', audit: [...estimate.audit, event] }],
    });
    return this.get(actor, id);
  }

  pay(actor: AuthenticatedUser, id: string, estimateId: string, confirmed: boolean) {
    const complaint = this.assertAdmin(actor, id);
    if (confirmed !== true) throw new BadRequestException('Explicit confirmation is required for mock payment');
    const workflow = this.complaints.estimateWorkflows.get(id);
    if (workflow?.payment?.estimateId === estimateId) return workflow.payment;

    const estimate = this.requireCurrent(id, estimateId, 'APPROVED_FOR_PAYMENT');
    this.assertOtherActor(actor, estimate);
    const worker = this.workforce.findById(estimate.workerId);
    const assignment = this.complaints.assignmentForComplaint(id);
    const payee = this.users.findAll().find((user) => user.id === worker.userId);
    if (!this.complaints.isCurrentPayeeEligible(complaint) || worker.id !== complaint.assignedWorkerId || worker.communityId !== complaint.communityId
      || assignment?.workerId !== worker.id || assignment.workerUserId !== worker.userId
      || estimate.audit[0].actorId !== worker.userId || payee?.role !== RoleName.MaintenanceWorker
      || payee.communityId !== complaint.communityId || (payee.accountState && payee.accountState !== 'ACTIVE')) {
      throw new ConflictException('The approved estimate no longer matches the complaint assignment');
    }
    const paymentId = randomUUID();
    const timestamp = new Date().toISOString();
    const payment: MockWorkerPayment = {
      id: paymentId, reference: `MOCK-${paymentId}`, complaintId: id, estimateId, workerId: worker.id, communityId: complaint.communityId,
      amountPaise: estimate.totalPaise, currency: 'INR', status: 'SUCCESS', mock: true, initiatedBy: actor.id, initiatedAt: timestamp, paidAt: timestamp,
    };
    const auditContext = { complaintId: id, estimateId, paymentId, timestamp, previousStatus: estimate.status };
    const initiated = this.event(actor, { ...auditContext, action: 'MOCK_PAYMENT_INITIATED', newStatus: estimate.status });
    const succeeded = this.event(actor, { ...auditContext, action: 'MOCK_PAYMENT_SUCCEEDED', newStatus: 'PAID' });
    // This synchronous write commits the receipt and estimate together in the current single-process store.
    this.complaints.estimateWorkflows.set(id, {
      revisions: [...workflow!.revisions.slice(0, -1), { ...estimate, status: 'PAID', audit: [...estimate.audit, initiated, succeeded] }],
      payment,
    });
    return payment;
  }

  private requireTowerComplaint(actor: AuthenticatedUser, id: string): CommunityComplaint {
    const complaint = this.complaints.findById(id);
    this.complaints.assertCanViewComplaint(actor, complaint);
    if (complaint.type === ComplaintType.Community) throw new ForbiddenException('This workflow requires a tower-managed complaint');
    return complaint;
  }

  private assertAdmin(actor: AuthenticatedUser, id: string) {
    this.requireRole(actor, RoleName.CommunityAdmin);
    return this.requireTowerComplaint(actor, id);
  }

  private requireRole(actor: AuthenticatedUser, role: RoleName) {
    if (actor.role !== role) throw new ForbiddenException('You cannot perform this estimate action');
  }

  private assertOtherActor(actor: AuthenticatedUser, estimate: ComplaintEstimate) {
    if (estimate.audit[0].actorId === actor.id) {
      throw new ForbiddenException('The estimate submitter cannot make decisions or execute payment for this estimate');
    }
  }

  private requireCurrent(id: string, estimateId: string, expectedStatus: EstimateStatus) {
    const estimate = this.complaints.estimateWorkflows.get(id)?.revisions.at(-1);
    if (!estimate || estimate.id !== estimateId || estimate.status !== expectedStatus) {
      throw new ConflictException('The estimate is no longer eligible for this action. Refresh to see its current status');
    }
    return estimate;
  }

  private recordDecision(actor: AuthenticatedUser, id: string, estimateId: string, status: EstimateStatus, action: EstimateAuditEvent['action'], reason?: string) {
    const feedback = reason?.trim();
    if (!feedback && (action === 'TOWER_REJECT' || action === 'TOWER_RETURN' || action === 'ADMIN_REJECT')) {
      throw new BadRequestException('Provide a reason or revision feedback');
    }
    const workflow = this.complaints.estimateWorkflows.get(id)!;
    const estimate = workflow.revisions.at(-1)!;
    const event = this.event(actor, {
      action, complaintId: id, estimateId, previousStatus: estimate.status, newStatus: status,
      timestamp: new Date().toISOString(), ...(feedback ? { reason: feedback } : {}),
    });
    this.complaints.estimateWorkflows.set(id, {
      revisions: [...workflow.revisions.slice(0, -1), { ...estimate, status, audit: [...estimate.audit, event] }],
    });
    return this.get(actor, id);
  }

  private event(actor: AuthenticatedUser, entry: Omit<EstimateAuditEvent, 'actorId' | 'actorRole' | 'actorName'>): EstimateAuditEvent {
    return { ...entry, actorId: actor.id, actorRole: actor.role, actorName: this.users.findById(actor.id).name };
  }
}
