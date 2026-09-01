import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { randomUUID } from 'crypto';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { ComplaintStatus } from '../../common/enums/status.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { WorkforceService } from '../workforce/workforce.service';
import { WorkerStatus } from '../workforce/workforce.dto';
import { AssignWorkerDto, CommunityComplaint, ComplaintAssignment, ComplaintAssignmentStatus, ComplaintAttachment, ComplaintReview, ComplaintType, CreateCommunityComplaintDto, CreateComplaintReviewDto, ResolveWorkDto, TransitionComplaintStatusDto, UpdateCommunityComplaintDto, VerifyResolutionDto } from './complaints.dto';

const seededAt = '2026-01-01T00:00:00.000Z';
const seededComplaints: CommunityComplaint[] = [
  { id: '60000000-0000-4000-8000-000000000001', residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', type: ComplaintType.Apartment, title: 'Water leakage in kitchen', description: 'Water is leaking below the kitchen sink.', requiredWorkType: 'PLUMBING' as any, communityId: '10000000-0000-4000-8000-000000000001', towerId: '20000000-0000-4000-8000-000000000001', floorId: '30000000-0000-4000-8000-000000000011', apartmentId: '40000000-0000-4000-8000-000000000011', responsibleRole: RoleName.TowerRepresentative, responsibleUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', responsibleUserName: 'Arun Patel', status: ComplaintStatus.Submitted, statusHistory: [{ status: ComplaintStatus.Submitted, changedAt: seededAt, changedByRole: 'SYSTEM' }], attachments: [], createdAt: seededAt, updatedAt: seededAt },
  { id: '60000000-0000-4000-8000-000000000002', residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', type: ComplaintType.Tower, title: 'Lift not working', description: 'The Tower B lift is not operating.', requiredWorkType: 'LIFT_MAINTENANCE' as any, communityId: '10000000-0000-4000-8000-000000000001', towerId: '20000000-0000-4000-8000-000000000002', floorId: '30000000-0000-4000-8000-000000000022', apartmentId: '40000000-0000-4000-8000-000000000041', responsibleRole: RoleName.TowerRepresentative, responsibleUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', responsibleUserName: 'Sana Iyer', status: ComplaintStatus.Submitted, statusHistory: [{ status: ComplaintStatus.Submitted, changedAt: seededAt, changedByRole: 'SYSTEM' }], attachments: [], createdAt: seededAt, updatedAt: seededAt },
  { id: '60000000-0000-4000-8000-000000000003', residentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', type: ComplaintType.Community, title: 'Main water supply issue', description: 'Community water pressure is low.', requiredWorkType: 'PLUMBING' as any, communityId: '10000000-0000-4000-8000-000000000001', towerId: '20000000-0000-4000-8000-000000000001', floorId: '30000000-0000-4000-8000-000000000011', apartmentId: '40000000-0000-4000-8000-000000000011', responsibleRole: RoleName.CommunityAdmin, responsibleUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', responsibleUserName: 'Meera Shah', status: ComplaintStatus.Submitted, statusHistory: [{ status: ComplaintStatus.Submitted, changedAt: seededAt, changedByRole: 'SYSTEM' }], attachments: [], createdAt: seededAt, updatedAt: seededAt },
  { id: '60000000-0000-4000-8000-000000000004', residentId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4', type: ComplaintType.Community, title: 'Community B water issue', description: 'Community B water pressure is low.', requiredWorkType: 'PLUMBING' as any, communityId: '10000000-0000-4000-8000-000000000002', towerId: '20000000-0000-4000-8000-000000000011', floorId: '30000000-0000-4000-8000-000000000111', apartmentId: '40000000-0000-4000-8000-000000000111', responsibleRole: RoleName.CommunityAdmin, responsibleUserId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', responsibleUserName: 'Nisha Rao', status: ComplaintStatus.Submitted, statusHistory: [{ status: ComplaintStatus.Submitted, changedAt: seededAt, changedByRole: 'SYSTEM' }], attachments: [], createdAt: seededAt, updatedAt: seededAt },
];
@Injectable()
export class ComplaintsService {
  private readonly crud = new CrudService(new CrudRepository(seededComplaints), 'Complaint');
  private readonly assignments: ComplaintAssignment[] = [];
  private readonly reviews: ComplaintReview[] = [];
  constructor(@Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>, private readonly community: CommunityService, private readonly workforce: WorkforceService) {}
  findAll() { return this.crud.findAll(); } findById(id: string) { return this.crud.findById(id); }
  findAllForActor(actor: AuthenticatedUser) {
    if (actor.role === RoleName.SuperAdmin) return this.findAll().map((item) => this.toViewModel(this.assertComplaintCommunity(item)));
    if (actor.role === RoleName.CommunityAdmin) {
      const communityId = this.actorCommunityId(actor);
      return this.findAll().map((item) => this.assertComplaintCommunity(item)).filter((item) => item.communityId === communityId).map((item) => this.toViewModel(item));
    }
    if (actor.role === RoleName.Resident) return this.findAll().map((item) => this.assertComplaintCommunity(item)).filter((item) => item.residentId === actor.id).map((item) => this.toViewModel(item));
    if (actor.role === RoleName.TowerRepresentative) {
      const representative = this.users.findById(actor.id);
      return this.findAll().map((item) => this.assertComplaintCommunity(item)).filter((item) => item.towerId === representative.towerId && item.type !== ComplaintType.Community).map((item) => this.toViewModel(item));
    }
    const worker = this.authenticatedWorker(actor);
    return this.findAll().map((item) => this.assertComplaintCommunity(item)).filter((item) => item.communityId === worker.communityId && this.assignments.some((assignment) => assignment.complaintId === item.id && assignment.workerId === worker.id)).map((item) => this.toViewModel(item));
  }
  findByIdForActor(actor: AuthenticatedUser, id: string) {
    const complaint = this.findById(id);
    this.assertCanViewComplaint(actor, complaint);
    return this.toViewModel(complaint);
  }
  create(actor: AuthenticatedUser, dto: CreateCommunityComplaintDto) {
    if (actor.role !== RoleName.Resident) throw new ForbiddenException('Only RESIDENT users may create complaints');
    const location = this.residentLocation(actor.id);
    this.validateRequestedLocation(dto, location);
    const now = new Date().toISOString();
    const authority = this.resolveAuthority(dto.type, location.towerId, location.communityId);
    return this.crud.create({ residentId: actor.id, type: dto.type, title: dto.title.trim(), description: dto.description.trim(), requiredWorkType: dto.requiredWorkType, ...location, ...authority, status: ComplaintStatus.Submitted, statusHistory: [{ status: ComplaintStatus.Submitted, changedAt: now, changedByRole: 'SYSTEM' }], attachments: [], createdAt: now, updatedAt: now });
  }
  update(actor: AuthenticatedUser, id: string, dto: UpdateCommunityComplaintDto) {
    const complaint = this.findById(id);
    this.assertCanViewComplaint(actor, complaint);
    if (![RoleName.Resident, RoleName.CommunityAdmin].includes(actor.role)) throw new ForbiddenException('Insufficient complaint update permissions');
    if (!dto.title && !dto.description) throw new BadRequestException('At least one editable field must be provided');
    return this.crud.update(id, { ...(dto.title ? { title: dto.title.trim() } : {}), ...(dto.description ? { description: dto.description.trim() } : {}), updatedAt: new Date().toISOString() });
  }
  delete(actor: AuthenticatedUser, id: string) {
    const complaint = this.findById(id);
    this.assertCanViewComplaint(actor, complaint);
    if (actor.role !== RoleName.CommunityAdmin) throw new ForbiddenException('Only Community Admins may delete complaints');
    return this.crud.delete(id);
  }
  eligibleWorkers(actor: AuthenticatedUser, id: string) {
    const complaint = this.findById(id);
    this.assertCanActAsAuthority(actor, complaint);
    const complaintCommunityId = this.assertComplaintCommunity(complaint).communityId;
    return this.workforce.findAll().filter((worker) => worker.communityId === complaintCommunityId && worker.status === WorkerStatus.Available && worker.specialization === complaint.requiredWorkType && !this.hasActiveAssignment(worker.id));
  }
  assignWorker(id: string, dto: AssignWorkerDto, actor: AuthenticatedUser) {
    const complaint = this.findById(id);
    this.assertCanActAsAuthority(actor, complaint);
    if (complaint.status !== ComplaintStatus.UnderReview) throw new BadRequestException('Only UNDER_REVIEW complaints can receive a worker assignment');
    if (complaint.assignedWorkerId || this.assignments.some((assignment) => assignment.complaintId === id && assignment.status !== ComplaintAssignmentStatus.Completed)) throw new BadRequestException('Complaint already has an active worker assignment');
    const worker = this.workforce.assertValidAssignmentTarget(dto.workerId);
    if (worker.communityId !== this.assertComplaintCommunity(complaint).communityId) throw new BadRequestException('Worker must belong to the complaint community');
    if (worker.status !== WorkerStatus.Available) throw new BadRequestException('Worker is not available');
    if (worker.specialization !== complaint.requiredWorkType) throw new BadRequestException('Worker specialization does not match the complaint work type');
    if (this.hasActiveAssignment(worker.id)) throw new BadRequestException('Worker already has an active assignment');
    const now = new Date().toISOString();
    const assignment: ComplaintAssignment = { id: randomUUID(), complaintId: id, workerId: worker.id, status: ComplaintAssignmentStatus.Assigned, assignedAt: now };
    this.assignments.push(assignment);
    this.workforce.updateSystemStatus(worker.id, WorkerStatus.Busy);
    return this.updateStatus(complaint, ComplaintStatus.Assigned, actor.role, { assignedWorkerId: worker.id, updatedAt: now, statusHistory: [...complaint.statusHistory, { status: ComplaintStatus.Assigned, changedAt: now, changedByRole: actor.role }] });
  }
  startWork(id: string, actor: AuthenticatedUser) {
    const complaint = this.findById(id); const assignment = this.activeAssignment(id);
    this.ensureAssignedWorker(complaint, assignment, this.authenticatedWorker(actor), actor);
    if (complaint.status !== ComplaintStatus.Assigned) throw new BadRequestException('Only ASSIGNED complaints can be started');
    const now = new Date().toISOString(); assignment.status = ComplaintAssignmentStatus.InProgress; assignment.startedAt = now;
    return this.updateStatus(complaint, ComplaintStatus.InProgress, actor.role, { updatedAt: now, statusHistory: [...complaint.statusHistory, { status: ComplaintStatus.InProgress, changedAt: now, changedByRole: actor.role }] });
  }
  resolveWork(id: string, dto: ResolveWorkDto, actor: AuthenticatedUser) {
    const complaint = this.findById(id); const assignment = this.activeAssignment(id);
    this.ensureAssignedWorker(complaint, assignment, this.authenticatedWorker(actor), actor);
    if (complaint.status !== ComplaintStatus.InProgress) throw new BadRequestException('Only IN_PROGRESS complaints can be resolved');
    const proofAttachmentIds = [...new Set(dto.proofAttachmentIds)];
    if (proofAttachmentIds.length !== dto.proofAttachmentIds.length) throw new BadRequestException('Resolution proof attachments must be unique');
    const proofAttachments = complaint.attachments.filter((attachment) => proofAttachmentIds.includes(attachment.id));
    if (proofAttachments.length !== proofAttachmentIds.length || proofAttachments.some((attachment) => attachment.uploadedByRole !== RoleName.MaintenanceWorker || attachment.purpose !== 'RESOLUTION_PROOF')) {
      throw new BadRequestException('Resolution proof must contain only your uploaded proof media');
    }
    const now = new Date().toISOString(); assignment.status = ComplaintAssignmentStatus.Completed; assignment.completedAt = now;
    this.workforce.updateSystemStatus(assignment.workerId, WorkerStatus.Available);
    return this.updateStatus(complaint, ComplaintStatus.PendingVerification, actor.role, {
      resolutionProof: { problemFound: dto.problemFound.trim(), resolutionSummary: dto.resolutionSummary.trim(), attachmentIds: proofAttachmentIds, submittedAt: now, submittedByWorkerId: assignment.workerId },
      updatedAt: now,
      statusHistory: [...complaint.statusHistory, { status: ComplaintStatus.PendingVerification, changedAt: now, changedByRole: actor.role }],
    });
  }
  verifyResolution(id: string, dto: VerifyResolutionDto, actor: AuthenticatedUser) {
    const complaint = this.findById(id);
    this.assertCanActAsAuthority(actor, complaint);
    if (complaint.status !== ComplaintStatus.PendingVerification || !complaint.resolutionProof) throw new BadRequestException('Only a complaint awaiting verification can be verified');
    const assignment = this.assignmentForComplaint(id);
    if (!assignment || assignment.status !== ComplaintAssignmentStatus.Completed) throw new BadRequestException('Complaint has no completed worker assignment');
    const now = new Date().toISOString();
    const verifier = this.users.findById(actor.id);
    this.workforce.addCompletedComplaint(assignment.workerId, id);
    return this.updateStatus(complaint, ComplaintStatus.Resolved, actor.role, {
      resolutionVerification: { authorityRating: dto.authorityRating, verifiedAt: now, verifiedByUserId: actor.id, verifiedByUserName: verifier.name },
      updatedAt: now,
      statusHistory: [...complaint.statusHistory, { status: ComplaintStatus.Resolved, changedAt: now, changedByRole: actor.role }],
    });
  }
  assignmentForComplaint(id: string) { return this.assignments.find((assignment) => assignment.complaintId === id); }
  addAttachment(id: string, attachment: ComplaintAttachment) {
    const complaint = this.findById(id);
    return this.crud.update(id, { attachments: [...complaint.attachments, attachment], updatedAt: new Date().toISOString() });
  }
  assertCanUploadResolutionProof(actor: AuthenticatedUser, complaint: CommunityComplaint) {
    const assignment = this.activeAssignment(complaint.id);
    this.ensureAssignedWorker(complaint, assignment, this.authenticatedWorker(actor), actor);
    if (complaint.status !== ComplaintStatus.InProgress) throw new BadRequestException('Resolution proof can be uploaded only while work is in progress');
  }
  findReview(id: string) {
    const review = this.reviews.find((item) => item.complaintId === id);
    if (!review) throw new BadRequestException('Complaint review was not found');
    return review;
  }
  findReviewForActor(id: string, actor: AuthenticatedUser) {
    const complaint = this.findById(id);
    this.assertCanViewComplaint(actor, complaint);
    return this.findReview(id);
  }
  submitReview(id: string, dto: CreateComplaintReviewDto, actor: AuthenticatedUser) {
    const complaint = this.findById(id);
    if (actor.role !== RoleName.Resident) throw new ForbiddenException('Only a RESIDENT may submit a complaint review');
    if (complaint.residentId !== actor.id) throw new ForbiddenException('Residents may review only their own complaints');
    if (complaint.status !== ComplaintStatus.Resolved || !complaint.resolutionVerification) throw new BadRequestException('Only authority-verified RESOLVED complaints can be reviewed');
    if (this.reviews.some((review) => review.complaintId === id)) throw new BadRequestException('A complaint can have only one review');
    const assignment = this.assignmentForComplaint(id);
    if (!assignment || assignment.status !== ComplaintAssignmentStatus.Completed) throw new BadRequestException('Complaint has no completed worker assignment');
    const worker = this.workforce.findById(assignment.workerId);
    const now = new Date().toISOString();
    const residentRating = Number(((dto.speedRating + dto.qualityRating + dto.communicationRating) / 3).toFixed(2));
    const review: ComplaintReview = { id: randomUUID(), complaintId: id, residentId: complaint.residentId, workerId: assignment.workerId, rating: residentRating, speedRating: dto.speedRating, qualityRating: dto.qualityRating, communicationRating: dto.communicationRating, ...(dto.feedback ? { feedback: dto.feedback.trim() } : {}), createdAt: now, updatedAt: now };
    const workerReviews = [...this.reviews.filter((item) => item.workerId === worker.id), review];
    const rating = Number((workerReviews.reduce((sum, item) => {
      const reviewedComplaint = this.findById(item.complaintId);
      return sum + ((item.rating + (reviewedComplaint.resolutionVerification?.authorityRating ?? item.rating)) / 2);
    }, 0) / workerReviews.length).toFixed(2));
    this.reviews.push(review);
    this.workforce.updatePerformance(worker.id, rating, workerReviews.length);
    return this.updateStatus(complaint, ComplaintStatus.Reviewed, actor.role, { updatedAt: now, statusHistory: [...complaint.statusHistory, { status: ComplaintStatus.Reviewed, changedAt: now, changedByRole: actor.role }] });
  }
  transitionStatus(id: string, dto: TransitionComplaintStatusDto, actor: AuthenticatedUser) {
    const complaint = this.findById(id);
    const expectedStatus = VALID_TRANSITIONS[complaint.status];
    if (!expectedStatus || dto.status !== expectedStatus) throw new BadRequestException(`Invalid status transition: ${complaint.status} → ${dto.status}`);
    this.validateTransitionActor(complaint, actor);
    const changedAt = new Date().toISOString();
    return this.crud.update(id, { status: dto.status, statusHistory: [...complaint.statusHistory, { status: dto.status, changedAt, changedByRole: actor.role }], updatedAt: changedAt });
  }
  private residentLocation(residentId: string) {
    const user = this.users.findById(residentId);
    if (user.role !== RoleName.Resident) throw new BadRequestException('Complaints must be submitted by a RESIDENT user');
    const hierarchy = this.community.resolveResidentHierarchy(residentId);
    return { communityId: hierarchy.community.id, towerId: hierarchy.tower.id, floorId: hierarchy.floor.id, apartmentId: hierarchy.apartment.id };
  }
  private validateRequestedLocation(dto: CreateCommunityComplaintDto, location: { communityId: string; towerId: string; floorId: string; apartmentId: string }) {
    if (dto.apartmentId && dto.apartmentId !== location.apartmentId) throw new BadRequestException('Apartment does not belong to the resident');
    if (dto.towerId && dto.towerId !== location.towerId) throw new BadRequestException('Tower does not belong to the resident');
    if (dto.communityId && dto.communityId !== location.communityId) throw new BadRequestException('Community does not belong to the resident');
  }
  private resolveAuthority(type: ComplaintType, towerId: string, communityId: string) {
    if (type === ComplaintType.Community) {
      const admin = this.users.findAll().find((user) => user.role === RoleName.CommunityAdmin && user.communityId === communityId);
      if (!admin) throw new BadRequestException('No Community Admin is available for this community');
      return { responsibleRole: RoleName.CommunityAdmin as const, responsibleUserId: admin.id, responsibleUserName: admin.name };
    }
    const representative = this.users.findAll().find((user) => user.role === RoleName.TowerRepresentative && user.towerId === towerId);
    if (!representative) throw new BadRequestException('No Tower Representative is assigned to this tower');
    return { responsibleRole: RoleName.TowerRepresentative as const, responsibleUserId: representative.id, responsibleUserName: representative.name };
  }
  private validateTransitionActor(complaint: CommunityComplaint, actor: AuthenticatedUser) {
    if (complaint.status === ComplaintStatus.Resolved) {
      if (actor.role !== RoleName.Resident) throw new BadRequestException('Only a RESIDENT may move a resolved complaint to review');
      return;
    }
    this.assertCanActAsAuthority(actor, complaint);
  }
  private activeAssignment(complaintId: string) { const assignment = this.assignments.find((item) => item.complaintId === complaintId && item.status !== ComplaintAssignmentStatus.Completed); if (!assignment) throw new BadRequestException('Complaint has no active worker assignment'); return assignment; }
  private hasActiveAssignment(workerId: string) { return this.assignments.some((item) => item.workerId === workerId && item.status !== ComplaintAssignmentStatus.Completed); }
  assertCanViewComplaint(actor: AuthenticatedUser, complaint: CommunityComplaint) {
    const complaintCommunityId = this.assertComplaintCommunity(complaint).communityId;
    if (actor.role === RoleName.SuperAdmin) return;
    if (actor.role === RoleName.CommunityAdmin && this.actorCommunityId(actor) === complaintCommunityId) return;
    if (actor.role === RoleName.Resident && complaint.residentId === actor.id) return;
    if (actor.role === RoleName.TowerRepresentative) {
      const representative = this.users.findById(actor.id);
      if (complaint.type !== ComplaintType.Community && complaint.towerId === representative.towerId) return;
    }
    if (actor.role === RoleName.MaintenanceWorker) {
      const worker = this.authenticatedWorker(actor);
      if (worker.communityId === complaintCommunityId && this.assignments.some((assignment) => assignment.complaintId === complaint.id && assignment.workerId === worker.id)) return;
    }
    throw new ForbiddenException('You do not have access to this complaint');
  }
  private assertCanActAsAuthority(actor: AuthenticatedUser, complaint: CommunityComplaint) {
    const complaintCommunityId = this.assertComplaintCommunity(complaint).communityId;
    if (actor.role === RoleName.SuperAdmin) return;
    if (actor.role === RoleName.CommunityAdmin && complaint.responsibleRole === RoleName.CommunityAdmin && complaint.responsibleUserId === actor.id && this.actorCommunityId(actor) === complaintCommunityId) return;
    if (actor.role === RoleName.TowerRepresentative && complaint.responsibleRole === RoleName.TowerRepresentative && complaint.responsibleUserId === actor.id) return;
    throw new ForbiddenException('Only the responsible authority may perform this action');
  }
  private authenticatedWorker(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.MaintenanceWorker) throw new ForbiddenException('Only Maintenance Workers have worker profiles');
    return this.workforce.findOwn(actor);
  }
  private ensureAssignedWorker(complaint: CommunityComplaint, assignment: ComplaintAssignment, worker: { id: string; communityId: string }, actor: AuthenticatedUser) {
    if (worker.communityId !== this.assertComplaintCommunity(complaint).communityId) throw new ForbiddenException('Workers may act only within their own community');
    if (complaint.assignedWorkerId !== worker.id || assignment.workerId !== worker.id) throw new ForbiddenException('Only the assigned maintenance worker may perform this action');
  }
  private actorCommunityId(actor: AuthenticatedUser) {
    const user = this.users.findById(actor.id);
    if (!user.communityId) throw new ForbiddenException('The authenticated user has no community association');
    return user.communityId;
  }
  private assertComplaintCommunity(complaint: CommunityComplaint) {
    const location = this.residentLocation(complaint.residentId);
    if (complaint.communityId !== location.communityId || complaint.towerId !== location.towerId || complaint.floorId !== location.floorId || complaint.apartmentId !== location.apartmentId) {
      throw new ForbiddenException('Complaint location no longer matches the resident hierarchy');
    }
    return complaint;
  }
  private toViewModel(complaint: CommunityComplaint) {
    const community = this.community.getCommunity(complaint.communityId);
    const tower = this.community.getTower(complaint.towerId);
    const floor = this.community.getFloor(complaint.floorId);
    const apartment = this.community.getApartment(complaint.apartmentId);
    return {
      ...complaint,
      location: {
        communityName: community.name,
        towerName: tower.name,
        floorLabel: floor.label || String(floor.floorNumber),
        apartmentNumber: apartment.apartmentNumber,
      },
    };
  }
  private updateStatus(complaint: CommunityComplaint, status: ComplaintStatus, _actorRole: RoleName, changes: Partial<CommunityComplaint>) { return this.crud.update(complaint.id, { ...changes, status }); }
}

const VALID_TRANSITIONS: Partial<Record<ComplaintStatus, ComplaintStatus>> = {
  [ComplaintStatus.Submitted]: ComplaintStatus.UnderReview,
  [ComplaintStatus.Reviewed]: ComplaintStatus.Closed,
};
