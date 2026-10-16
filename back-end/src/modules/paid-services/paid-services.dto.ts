import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { WorkType } from '../workforce/workforce.dto';

export class CreateCatalogueDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
  @IsString() @Matches(/\S/) @MaxLength(2000) description!: string;
  @IsEnum(WorkType) specialization!: WorkType;
  // All monetary values are integer INR paise; no floating point arithmetic.
  @IsInt() @Min(1) @Max(100000000) startingPricePaise!: number;
  @IsBoolean() active!: boolean;
}
export class UpdateCatalogueDto extends PartialType(CreateCatalogueDto) {}
export class CreateServiceRequestDto {
  @IsUUID('4') catalogueId!: string;
  @IsUUID('4') clientRequestId!: string;
  @IsString() @Matches(/\S/) @MaxLength(2000) description!: string;
}
export class VersionDto { @IsInt() @Min(1) version!: number; }
export class AssignServiceWorkerDto extends VersionDto { @IsUUID('4') workerId!: string; }
export class SubmitEstimateDto extends VersionDto {
  @IsInt() @Min(1) @Max(100000000) amountPaise!: number;
  @IsString() @Matches(/\S/) @MaxLength(2000) description!: string;
}
export enum EstimateDecision { Approve = 'APPROVE', Reject = 'REJECT', RequestRevision = 'REQUEST_REVISION' }
export class DecideEstimateDto extends VersionDto {
  @IsUUID('4') estimateId!: string;
  @IsEnum(EstimateDecision) decision!: EstimateDecision;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(2000) note?: string;
}
export class ScheduleServiceDto extends VersionDto {
  @IsISO8601({ strict: true }) @Matches(/(Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/(Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
}
export class CompleteServiceDto extends VersionDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) completionReport!: string;
  @IsInt() @Min(1) @Max(100000000) finalCostPaise!: number;
}
export class ServiceProgressDto extends VersionDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) note!: string;
}
export class ReviewFinalCostDto extends VersionDto {
  @IsBoolean() approved!: boolean;
  @IsString() @Matches(/\S/) @MaxLength(2000) note!: string;
}
export class ReportServicePaymentDto extends VersionDto {
  @IsString() @Matches(/\S/) @MaxLength(200) reference!: string;
  @IsUUID('4') evidenceId!: string;
}
export class VerifyServicePaymentDto extends VersionDto {
  @IsBoolean() approved!: boolean;
  @IsString() @Matches(/\S/) @MaxLength(2000) verificationNote!: string;
}
export class ReviewServiceDto extends VersionDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @Matches(/\S/) @MaxLength(2000) feedback!: string;
}

export interface CatalogueEntry {
  id: string; communityId: string; name: string; description: string;
  specialization: WorkType; startingPricePaise: number; active: boolean;
  createdAt: string; updatedAt: string;
}
export type ServiceStatus = 'REQUESTED' | 'ASSIGNED' | 'AWAITING_ESTIMATE_APPROVAL' | 'ESTIMATE_REJECTED' | 'REVISION_REQUESTED' | 'ESTIMATE_APPROVED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FINAL_COST_REJECTED' | 'FINAL_COST_APPROVED' | 'CANCELLED';
export interface ServiceEstimate {
  id: string; number: number; amountPaise: number; description: string; submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';
  decidedAt?: string; decisionNote?: string;
}
export interface PaymentEvidence {
  id: string; storedName: string; originalName: string; mimeType: string; uploadedAt: string;
}
export interface ServicePayment {
  id: string; requestId: string; workerId: string; payeeUserId: string; amountPaise: number; currency: 'INR';
  approvedBy: string; approvedAt: string;
  status: 'APPROVED' | 'PAYMENT_REPORTED' | 'EVIDENCE_VERIFIED' | 'RECEIPT_CONFIRMED';
  reference?: string; evidenceId?: string; reportedAt?: string;
  verifiedBy?: string; verifiedAt?: string; verificationNote?: string; receiptConfirmedAt?: string;
}
export interface PaidServiceRequest {
  id: string; clientRequestId: string; residentId: string; communityId: string; towerId: string; apartmentId: string;
  location: { communityName: string; towerName: string; floorLabel: string; apartmentNumber: string };
  service: { catalogueId: string; name: string; specialization: WorkType; startingPricePaise: number };
  description: string; status: ServiceStatus; version: number; workerId?: string;
  estimates: ServiceEstimate[]; approvedEstimateId?: string;
  appointment?: { startsAt: string; endsAt: string }; startedAt?: string;
  completionReport?: string; finalCostPaise?: number; completedAt?: string;
  finalReview?: { approved: boolean; note: string; reviewedBy: string; reviewedAt: string; estimateId: string };
  payment?: ServicePayment; evidence: PaymentEvidence[];
  review?: { rating: number; feedback: string; createdAt: string };
  history: { status: ServiceStatus; actorId: string; at: string; note: string }[];
  createdAt: string; updatedAt: string;
}
