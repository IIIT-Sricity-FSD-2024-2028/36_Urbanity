import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, Equals, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { RoleName } from '../../common/enums/roles.enum';

export const MAX_ESTIMATE_PAISE = 1_000_000_000;
export const COST_CATEGORIES = ['MATERIAL', 'LABOUR', 'ADDITIONAL'] as const;
const trim = Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class EstimateCostDto {
  @ApiProperty({ enum: [...COST_CATEGORIES] })
  @IsIn(COST_CATEGORIES) category!: typeof COST_CATEGORIES[number];
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @trim @IsString() @Length(1, 200) description!: string;
  @ApiProperty({ minimum: 1, maximum: 10_000 })
  @IsInt() @Min(1) @Max(10_000) quantity!: number;
  @ApiProperty({ minimum: 0, maximum: MAX_ESTIMATE_PAISE })
  @IsInt() @Min(0) @Max(MAX_ESTIMATE_PAISE) unitPricePaise!: number;
}

export class SubmitComplaintEstimateDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID('4') previousEstimateId?: string;
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @trim @IsString() @Length(10, 2000) inspection!: string;
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @trim @IsString() @Length(10, 2000) proposedResolution!: string;
  @ApiProperty({ minLength: 1, maxLength: 2000 })
  @trim @IsString() @Length(1, 2000) notes!: string;
  @ApiProperty({ minimum: 1, maximum: 8760 })
  @IsInt() @Min(1) @Max(8760) completionHours!: number;
  @ApiProperty({ type: [EstimateCostDto], minItems: 1, maxItems: 30 })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => EstimateCostDto) costs!: EstimateCostDto[];
}

export class TowerEstimateDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT', 'RETURN'] })
  @IsIn(['APPROVE', 'REJECT', 'RETURN']) decision!: 'APPROVE' | 'REJECT' | 'RETURN';
  @ApiPropertyOptional({ maxLength: 2000, description: 'Required when rejecting or returning an estimate' })
  @trim @IsOptional() @IsString() @Length(0, 2000) reason?: string;
}

export class AdminEstimateDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional({ maxLength: 2000, description: 'Required when rejecting payment' })
  @trim @IsOptional() @IsString() @Length(0, 2000) reason?: string;
}

export class ExecuteMockPaymentDto {
  @ApiProperty({ type: Boolean, example: true, description: 'Must be true to execute the mock payment' })
  @Equals(true) confirmed!: true;
}

export class CancelComplaintEstimateDto {
  @trim @IsString() @Length(1, 2000) reason!: string;
}

export type EstimateStatus = 'PENDING_TOWER_VERIFICATION' | 'RETURNED_FOR_REVISION' | 'REJECTED_BY_TOWER'
  | 'PENDING_COMMUNITY_ADMIN_APPROVAL' | 'REJECTED_BY_ADMIN' | 'APPROVED_FOR_PAYMENT' | 'PAID' | 'CANCELLED';

export interface EstimateAuditEvent {
  actorId: string;
  actorRole: RoleName;
  actorName: string;
  action: 'SUBMIT_ESTIMATE' | 'TOWER_APPROVE' | 'TOWER_REJECT' | 'TOWER_RETURN' | 'ADMIN_APPROVE'
    | 'ADMIN_REJECT' | 'MOCK_PAYMENT_INITIATED' | 'MOCK_PAYMENT_SUCCEEDED' | 'CANCEL_ESTIMATE';
  previousStatus: EstimateStatus | 'AWAITING_WORKER_ESTIMATE';
  newStatus: EstimateStatus;
  timestamp: string;
  complaintId: string;
  estimateId: string;
  paymentId?: string;
  reason?: string;
}

export interface ComplaintEstimate {
  id: string;
  workerId: string;
  inspection: string;
  proposedResolution: string;
  notes: string;
  completionHours: number;
  costs: (EstimateCostDto & { subtotalPaise: number })[];
  totalPaise: number;
  submittedAt: string;
  status: EstimateStatus;
  audit: EstimateAuditEvent[];
}

export interface MockWorkerPayment {
  id: string;
  reference: string;
  complaintId: string;
  estimateId: string;
  workerId: string;
  communityId: string;
  amountPaise: number;
  currency: 'INR';
  status: 'SUCCESS';
  mock: true;
  initiatedBy: string;
  initiatedAt: string;
  paidAt: string;
}

export interface ComplaintEstimateWorkflow {
  revisions: ComplaintEstimate[];
  payment?: MockWorkerPayment;
}
