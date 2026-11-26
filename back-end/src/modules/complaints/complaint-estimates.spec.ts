import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { ComplaintStatus } from '../../common/enums/status.enum';
import type { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import { WorkType, WorkerStatus } from '../workforce/workforce.dto';
import { WorkforceService } from '../workforce/workforce.service';
import { SubmitComplaintEstimateDto } from './complaint-estimates.dto';
import { ComplaintEstimatesService } from './complaint-estimates.service';
import { ComplaintAssignmentStatus, ComplaintType } from './complaints.dto';
import { ComplaintsModule } from './complaints.module';
import { ComplaintsService } from './complaints.service';

const actor = (id: string, role: RoleName): AuthenticatedUser => ({ id, role, email: `${id}@test.local` });
const worker = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', RoleName.MaintenanceWorker);
const otherWorker = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', RoleName.MaintenanceWorker);
const resident = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', RoleName.Resident);
const otherResident = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', RoleName.Resident);
const tower = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', RoleName.TowerRepresentative);
const otherTower = actor('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8', RoleName.TowerRepresentative);
const admin = actor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', RoleName.CommunityAdmin);
const otherAdmin = actor('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', RoleName.CommunityAdmin);
const workerId = '50000000-0000-4000-8000-000000000001';
const payload: SubmitComplaintEstimateDto = {
  inspection: 'The drain trap is cracked.',
  proposedResolution: 'Replace the trap and check for leaks.',
  completionHours: 2,
  notes: 'Vanity is accessible.',
  costs: [
    { category: 'MATERIAL', description: 'Replacement trap', quantity: 2, unitPricePaise: 10550 },
    { category: 'LABOUR', description: 'Plumber hour', quantity: 1, unitPricePaise: 80000 },
  ],
};

describe('ComplaintEstimatesService', () => {
  let module: TestingModule;
  let complaints: ComplaintsService;
  let estimates: ComplaintEstimatesService;
  let users: CrudService<User, Partial<User>, Partial<User>>;
  let id: string;
  const approve = { decision: 'APPROVE' } as const;
  const submit = () => {
    const result = estimates.submit(worker, id, payload);
    if (!('estimate' in result) || !result.estimate) throw new Error('Estimate missing from response');
    return result.estimate;
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({ imports: [ComplaintsModule] }).compile();
    complaints = module.get(ComplaintsService);
    estimates = module.get(ComplaintEstimatesService);
    users = module.get(serviceToken('users'));
    id = complaints.create(resident, {
      type: ComplaintType.Apartment, requiredWorkType: WorkType.Plumbing, title: 'Leak', description: 'The drain leaks.',
    }).id;
    complaints.transitionStatus(id, { status: ComplaintStatus.UnderReview }, tower);
    complaints.assignWorker(id, { workerId }, tower);
  });
  afterEach(async () => { await module.close(); });

  it('retains active assignments and verified work history even without an estimate', () => {
    expect(() => complaints.delete(admin, id)).toThrow('active worker assignments');
    expect(complaints.hasActiveAssignment(workerId)).toBe(true);
    // Simulate work started under the previous policy to check existing history remains protected.
    const legacy = complaints.findById(id);
    legacy.status = ComplaintStatus.InProgress;
    complaints.assignmentForComplaint(id)!.status = ComplaintAssignmentStatus.InProgress;
    expect(() => complaints.delete(admin, id)).toThrow('active worker assignments');
    const proofId = '70000000-0000-4000-8000-000000000001';
    complaints.addAttachment(id, { id: proofId, originalName: 'proof.png', storedName: 'proof.png', relativePath: 'complaints/proof.png',
      mimeType: 'image/png', size: 9, uploadedAt: new Date().toISOString(), uploadedByRole: worker.role, purpose: 'RESOLUTION_PROOF', retrievalUrl: '' });
    complaints.resolveWork(id, { problemFound: 'Cracked trap', resolutionSummary: 'Trap replaced', proofAttachmentIds: [proofId] }, worker);
    complaints.verifyResolution(id, { authorityRating: 5 }, tower);
    complaints.submitReview(id, { speedRating: 5, qualityRating: 5, communicationRating: 5 }, resident);
    expect(() => complaints.delete(admin, id)).toThrow('verified work history');
    expect(complaints.findById(id).status).toBe(ComplaintStatus.Reviewed);
    expect(complaints.hasActiveAssignment(workerId)).toBe(false);
  });

  it('allows the existing community-wide work path while gating tower repair until payment', () => {
    expect(() => complaints.startWork(id, worker)).toThrow(/only after mock payment/);
    const estimate = submit();
    estimates.decideAsTower(tower, id, estimate.id, approve);
    estimates.decideAsAdmin(admin, id, estimate.id, approve);
    expect(() => complaints.startWork(id, worker)).toThrow(/only after mock payment/);
    estimates.pay(admin, id, estimate.id, true);
    expect(complaints.startWork(id, worker).status).toBe(ComplaintStatus.InProgress);
    const communityId = '60000000-0000-4000-8000-000000000003';
    expect(complaints.canStartRepair(complaints.findById(communityId))).toBe(true);
  });

  it('cancels an unavailable worker’s unpaid estimate and requires the replacement to submit a fresh one', () => {
    const first = submit();
    estimates.decideAsTower(tower, id, first.id, approve);
    estimates.decideAsAdmin(admin, id, first.id, approve);
    const workforce = module.get(WorkforceService);
    workforce.updateSystemStatus(workerId, WorkerStatus.Inactive);
    expect(() => estimates.pay(admin, id, first.id, true)).toThrow(ConflictException);
    expect(() => estimates.cancel(otherTower, id, first.id, 'Worker disabled')).toThrow(ForbiddenException);
    expect(() => estimates.cancel(tower, id, first.id, ' ')).toThrow(BadRequestException);
    expect(estimates.cancel(tower, id, first.id, 'Worker disabled')).toMatchObject({
      status: 'CANCELLED', assigned: false, estimate: { audit: expect.arrayContaining([
        expect.objectContaining({ actorId: tower.id, action: 'CANCEL_ESTIMATE', reason: 'Worker disabled', previousStatus: 'APPROVED_FOR_PAYMENT' }),
      ]) },
    });
    expect(() => estimates.pay(admin, id, first.id, true)).toThrow(ConflictException);
    expect(() => estimates.get(worker, id)).toThrow(ForbiddenException);
    expect(workforce.findById(workerId).status).toBe(WorkerStatus.Inactive);
    const replacement = workforce.getWorkerProfileForUser(otherWorker.id);
    workforce.update(replacement.id, { specialization: WorkType.Plumbing });
    complaints.assignWorker(id, { workerId: replacement.id }, tower);
    expect(complaints.assignmentHistory(id).map(({ action }) => action)).toEqual(['ASSIGN_WORKER', 'REASSIGN_WORKER']);
    expect(estimates.get(otherWorker, id)).toMatchObject({ canSubmit: true, previousEstimateId: first.id, estimate: undefined });
    const revised = estimates.submit(otherWorker, id, { ...payload, previousEstimateId: first.id });
    expect(revised).toMatchObject({ status: 'PENDING_TOWER_VERIFICATION' });
    const second = 'estimate' in revised ? revised.estimate!.id : '';
    expect(() => estimates.decideAsAdmin(admin, id, second, approve)).toThrow(ConflictException);
    estimates.decideAsTower(tower, id, second, approve);
    estimates.decideAsAdmin(admin, id, second, approve);
    const receipt = estimates.pay(admin, id, second, true);
    expect(receipt).toMatchObject({ workerId: replacement.id, estimateId: second });
    expect(estimates.get(tower, id)).toMatchObject({ history: [{ id: first.id, status: 'CANCELLED' }, { id: second, status: 'PAID' }] });
    expect(() => estimates.cancel(tower, id, second, 'Cancel paid estimate')).toThrow(ConflictException);
  });

  it('keeps an approved estimate auditable and the replacement picker usable after the payee account is deleted', () => {
    const first = submit();
    estimates.decideAsTower(tower, id, first.id, approve);
    estimates.decideAsAdmin(admin, id, first.id, approve);
    const workforce = module.get(WorkforceService);
    const replacement = workforce.getWorkerProfileForUser(otherWorker.id);
    workforce.update(replacement.id, { specialization: WorkType.Plumbing });
    users.delete(worker.id);
    expect(() => estimates.pay(admin, id, first.id, true)).toThrow(ConflictException);
    estimates.cancel(tower, id, first.id, 'Worker account removed');
    expect(complaints.eligibleWorkers(tower, id).map(({ id }) => id)).toEqual([replacement.id]);
    expect(estimates.get(tower, id)).toMatchObject({ estimate: { id: first.id, status: 'CANCELLED' } });
  });

  it('derives cost subtotals and the total and scopes submission and review', () => {
    expect(() => estimates.submit(otherWorker, id, payload)).toThrow(ForbiddenException);
    expect(() => estimates.get(otherResident, id)).toThrow(ForbiddenException);
    const estimate = submit();
    expect(estimate).toMatchObject({ totalPaise: 101100, status: 'PENDING_TOWER_VERIFICATION', workerId });
    expect(estimate.costs.map(({ subtotalPaise }) => subtotalPaise)).toEqual([21100, 80000]);
    expect(() => submit()).toThrow(ConflictException);
    expect(estimates.get(resident, id)).toEqual({ available: true, assigned: true, status: 'PENDING_TOWER_VERIFICATION' });
    expect(estimates.get(admin, id)).toEqual({ available: false });
    expect(estimates.list(tower)).toHaveLength(1);
    expect(estimates.list(otherTower)).toEqual([]);
    expect(estimates.list(admin)).toEqual([]);
    expect(() => estimates.decideAsTower(worker, id, estimate.id, approve)).toThrow(ForbiddenException);
    expect(() => estimates.decideAsTower(otherTower, id, estimate.id, approve)).toThrow(ForbiddenException);
    expect(() => estimates.decideAsAdmin(admin, id, estimate.id, approve)).toThrow(ConflictException);
    expect(estimates.decideAsTower(tower, id, estimate.id, approve)).toMatchObject({ status: 'PENDING_COMMUNITY_ADMIN_APPROVAL' });
    expect(estimates.list(admin)).toHaveLength(1);
    expect(estimates.list(otherAdmin)).toEqual([]);
    expect(() => estimates.get(otherAdmin, id)).toThrow(ForbiddenException);
    expect(() => estimates.decideAsAdmin(otherAdmin, id, estimate.id, approve)).toThrow(ForbiddenException);
  });

  it.each([-1, 0.5, Infinity, NaN, 1_000_000_001, Number.MAX_SAFE_INTEGER + 1])('rejects invalid monetary values (%s)', (unitPricePaise) => {
    expect(() => estimates.submit(worker, id, {
      ...payload, costs: [{ ...payload.costs[0], unitPricePaise }],
    })).toThrow(BadRequestException);
  });

  it('does not let a reassociated worker review the estimate they submitted', () => {
    const estimate = submit();
    const { towerId } = complaints.findById(id);
    users.update(tower.id, { towerId: undefined });
    users.update(worker.id, { role: RoleName.TowerRepresentative, communityId: undefined, towerId });
    const formerWorker = { ...worker, role: RoleName.TowerRepresentative };

    expect(estimates.get(formerWorker, id)).toMatchObject({ canReview: false, status: 'PENDING_TOWER_VERIFICATION' });
    expect(() => estimates.decideAsTower(formerWorker, id, estimate.id, approve)).toThrow(ForbiddenException);
    expect(estimates.list(formerWorker)).toEqual([]);
  });

  it('requires different accounts for tower verification and admin approval after a role change', () => {
    const estimate = submit();
    estimates.decideAsTower(tower, id, estimate.id, approve);
    const { communityId } = complaints.findById(id);
    users.update(tower.id, { role: RoleName.CommunityAdmin, towerId: undefined, communityId });
    const formerRepresentative = { ...tower, role: RoleName.CommunityAdmin };

    expect(estimates.get(formerRepresentative, id)).toMatchObject({ canApprovePayment: false });
    expect(() => estimates.decideAsAdmin(formerRepresentative, id, estimate.id, approve)).toThrow(ForbiddenException);
    expect(estimates.decideAsAdmin(admin, id, estimate.id, approve)).toMatchObject({ status: 'APPROVED_FOR_PAYMENT' });
  });

  it.each(['deleted', 'moved'] as const)('keeps the estimate readable but refuses new payment when the worker account is %s', (change) => {
    const estimate = submit();
    estimates.decideAsTower(tower, id, estimate.id, approve);
    estimates.decideAsAdmin(admin, id, estimate.id, approve);
    if (change === 'deleted') users.delete(worker.id);
    else users.update(worker.id, { communityId: users.findById(otherAdmin.id).communityId });

    expect(() => estimates.pay(admin, id, estimate.id, true)).toThrow(ConflictException);
    expect(estimates.get(admin, id)).toMatchObject({
      status: 'APPROVED_FOR_PAYMENT', paymentStatus: 'NOT_PAID',
      complaint: { workerName: 'Kabir Das' }, estimate: { id: estimate.id },
    });
    expect(estimates.list(admin)).toHaveLength(1);
  });

  it('keeps an issued receipt readable and idempotent after the payee account is removed', () => {
    const estimate = submit();
    estimates.decideAsTower(tower, id, estimate.id, approve);
    estimates.decideAsAdmin(admin, id, estimate.id, approve);
    const receipt = estimates.pay(admin, id, estimate.id, true);
    users.delete(worker.id);

    expect(estimates.get(admin, id)).toMatchObject({ status: 'PAID', payment: receipt });
    expect(estimates.get(resident, id)).toEqual({ available: true, assigned: true, status: 'PAID' });
    expect(estimates.pay(admin, id, estimate.id, true)).toEqual(receipt);
  });

  it('preserves the estimate location through hierarchy edits', () => {
    const estimate = submit();
    estimates.decideAsTower(tower, id, estimate.id, approve);
    const community = module.get(CommunityService);
    const location = complaints.findById(id);
    const otherLocation = complaints.findById('60000000-0000-4000-8000-000000000002');

    expect(() => community.updateApartment(location.apartmentId, { floorId: otherLocation.floorId })).toThrow(ConflictException);
    expect(() => community.updateFloor(location.floorId, { towerId: otherLocation.towerId })).toThrow(ConflictException);
    expect(() => community.updateTower(location.towerId, { communityId: users.findById(otherAdmin.id).communityId })).toThrow(ConflictException);
    users.update(resident.id, { apartmentId: otherLocation.apartmentId });
    expect(() => community.deleteApartment(location.apartmentId)).toThrow(ConflictException);
    expect(estimates.get(admin, id)).toMatchObject({ estimate: { id: estimate.id }, status: 'PENDING_COMMUNITY_ADMIN_APPROVAL' });
  });

  it.each(['REJECT', 'RETURN'] as const)('requires feedback and a fresh review after a tower %s decision', (decision) => {
    const first = submit();
    expect(() => estimates.decideAsTower(tower, id, first.id, { decision, reason: '  ' })).toThrow(BadRequestException);
    estimates.decideAsTower(tower, id, first.id, { decision, reason: 'Itemize each material.' });
    expect(estimates.get(worker, id)).toMatchObject({ canSubmit: true, estimate: { audit: expect.arrayContaining([expect.objectContaining({ actorId: tower.id, reason: 'Itemize each material.' })]) } });
    expect(() => estimates.decideAsAdmin(admin, id, first.id, approve)).toThrow(ConflictException);
    expect(() => estimates.pay(admin, id, first.id, true)).toThrow(ConflictException);
    expect(() => submit()).toThrow(ConflictException);
    const revision = estimates.submit(worker, id, { ...payload, previousEstimateId: first.id });
    expect(revision).toMatchObject({ status: 'PENDING_TOWER_VERIFICATION', estimate: { id: expect.not.stringMatching(first.id) } });
    expect(() => estimates.decideAsTower(tower, id, first.id, approve)).toThrow(ConflictException);
    expect(estimates.get(tower, id)).toMatchObject({ history: [{ id: first.id }, { status: 'PENDING_TOWER_VERIFICATION' }] });
  });

  it('records rejection and sends corrected estimates through tower verification again', () => {
    const { id: revision } = submit();
    estimates.decideAsTower(tower, id, revision, approve);
    expect(() => estimates.decideAsAdmin(admin, id, revision, { decision: 'REJECT' })).toThrow(BadRequestException);
    estimates.decideAsAdmin(admin, id, revision, { decision: 'REJECT', reason: 'Reduce the labour estimate.' });
    expect(() => estimates.pay(admin, id, revision, true)).toThrow(ConflictException);
    expect(estimates.get(worker, id)).toMatchObject({ canSubmit: true, paymentStatus: 'NOT_PAID', status: 'REJECTED_BY_ADMIN' });
    const corrected = estimates.submit(worker, id, { ...payload, previousEstimateId: revision });
    if (!('estimate' in corrected) || !corrected.estimate) throw new Error('Revision missing');
    expect(estimates.get(admin, id)).toMatchObject({ estimate: { id: revision }, status: 'REJECTED_BY_ADMIN' });
    expect(() => estimates.decideAsAdmin(admin, id, corrected.estimate!.id, approve)).toThrow(ConflictException);
    estimates.decideAsTower(tower, id, corrected.estimate.id, approve);
    expect(estimates.get(admin, id)).toMatchObject({ estimate: { id: corrected.estimate.id }, history: [{ id: revision }, { id: corrected.estimate.id }] });
  });

  it('records an idempotent mock receipt and allows the separate complaint lifecycle to close normally', () => {
    const estimate = submit();
    estimates.decideAsTower(tower, id, estimate.id, approve);
    expect(() => estimates.pay(admin, id, estimate.id, true)).toThrow(ConflictException);
    estimates.decideAsAdmin(admin, id, estimate.id, approve);
    expect(() => estimates.pay(worker, id, estimate.id, true)).toThrow(ForbiddenException);
    expect(() => estimates.pay(otherAdmin, id, estimate.id, true)).toThrow(ForbiddenException);
    expect(() => estimates.pay(admin, id, estimate.id, false)).toThrow(BadRequestException);
    const receipt = estimates.pay(admin, id, estimate.id, true);
    expect(estimates.pay(admin, id, estimate.id, true)).toEqual(receipt);
    expect(receipt).toMatchObject({ amountPaise: estimate.totalPaise, mock: true, status: 'SUCCESS',
      estimateId: estimate.id, workerId, complaintId: id, initiatedBy: admin.id, currency: 'INR', reference: /^MOCK-/ });
    expect(complaints.findById(id).status).toBe(ComplaintStatus.Assigned);
    expect(estimates.get(worker, id)).toMatchObject({ payment: receipt, canSubmit: false });
    expect(estimates.get(resident, id)).toEqual({ available: true, assigned: true, status: 'PAID' });
    const record = estimates.get(admin, id);
    expect(record).toMatchObject({ assignment: { actorId: tower.id, actorRole: tower.role, previousStatus: 'UNDER_REVIEW',
      newStatus: 'ASSIGNED', action: 'ASSIGN_WORKER', complaintId: id, workerId },
      estimate: { audit: [
        expect.objectContaining({ action: 'SUBMIT_ESTIMATE', actorId: worker.id, previousStatus: 'AWAITING_WORKER_ESTIMATE' }),
        expect.objectContaining({ action: 'TOWER_APPROVE', actorId: tower.id, newStatus: 'PENDING_COMMUNITY_ADMIN_APPROVAL' }),
        expect.objectContaining({ action: 'ADMIN_APPROVE', actorId: admin.id, newStatus: 'APPROVED_FOR_PAYMENT' }),
        expect.objectContaining({ action: 'MOCK_PAYMENT_INITIATED', paymentId: receipt.id, actorRole: admin.role }),
        expect.objectContaining({ action: 'MOCK_PAYMENT_SUCCEEDED', paymentId: receipt.id, newStatus: 'PAID', timestamp: receipt.paidAt }),
      ] } });
    expect(() => complaints.delete(admin, id)).toThrow(ConflictException);

    complaints.startWork(id, worker);
    const proofId = '70000000-0000-4000-8000-000000000001';
    complaints.addAttachment(id, { id: proofId, originalName: 'proof.png', storedName: 'proof.png', relativePath: 'complaints/proof.png',
      mimeType: 'image/png', size: 9, uploadedAt: receipt.paidAt, uploadedByRole: worker.role, purpose: 'RESOLUTION_PROOF', retrievalUrl: '' });
    expect(complaints.resolveWork(id, { problemFound: 'Cracked trap', resolutionSummary: 'Trap replaced', proofAttachmentIds: [proofId] }, worker).status)
      .toBe(ComplaintStatus.PendingVerification);
    complaints.verifyResolution(id, { authorityRating: 5 }, tower);
    complaints.submitReview(id, { speedRating: 5, qualityRating: 5, communicationRating: 5 }, resident);
    expect(complaints.transitionStatus(id, { status: ComplaintStatus.Closed }, tower).status).toBe(ComplaintStatus.Closed);
    expect(estimates.get(tower, id)).toMatchObject({ status: 'PAID', payment: receipt });
  });
});
