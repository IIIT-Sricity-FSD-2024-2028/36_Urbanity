import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ComplaintStatus } from '../../common/enums/status.enum';
import { WorkType } from '../workforce/workforce.dto';

export enum ComplaintType { Apartment = 'APARTMENT', Tower = 'TOWER', Community = 'COMMUNITY' }
export class ComplaintAttachment {
  @ApiProperty() id!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
  @ApiProperty() uploadedAt!: string;
  @ApiProperty() retrievalUrl!: string;
  @ApiProperty() uploadedByRole!: string;
  @ApiPropertyOptional({ enum: ['COMPLAINT', 'RESOLUTION_PROOF'] }) purpose?: 'COMPLAINT' | 'RESOLUTION_PROOF';
  storedName!: string;
  relativePath!: string;
}
export class ResolutionProof {
  @ApiProperty() problemFound!: string;
  @ApiProperty() resolutionSummary!: string;
  @ApiProperty({ type: [String] }) attachmentIds!: string[];
  @ApiProperty() submittedAt!: string;
  @ApiProperty() submittedByWorkerId!: string;
}
export class ResolutionVerification {
  @ApiProperty() authorityRating!: number;
  @ApiProperty() verifiedAt!: string;
  @ApiProperty() verifiedByUserId!: string;
  @ApiProperty() verifiedByUserName!: string;
}
export class ComplaintLocationSummary {
  @ApiProperty() communityName!: string;
  @ApiProperty() towerName!: string;
  @ApiProperty() floorLabel!: string;
  @ApiProperty() apartmentNumber!: string;
}
export class CommunityComplaint {
  @ApiProperty() id!: string;
  @ApiProperty() residentId!: string;
  @ApiProperty({ enum: ComplaintType }) type!: ComplaintType;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: WorkType }) requiredWorkType!: WorkType;
  @ApiProperty() communityId!: string;
  @ApiProperty() towerId!: string;
  @ApiProperty() floorId!: string;
  @ApiProperty() apartmentId!: string;
  @ApiProperty({ enum: ['TOWER_REPRESENTATIVE', 'COMMUNITY_ADMIN'] }) responsibleRole!: 'TOWER_REPRESENTATIVE' | 'COMMUNITY_ADMIN';
  @ApiProperty() responsibleUserId!: string;
  @ApiProperty() responsibleUserName!: string;
  @ApiProperty({ enum: ComplaintStatus }) status!: ComplaintStatus;
  @ApiProperty({ type: [Object] }) statusHistory!: ComplaintStatusHistoryEntry[];
  @ApiProperty({ type: [ComplaintAttachment] }) attachments!: ComplaintAttachment[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiPropertyOptional() assignedWorkerId?: string;
  @ApiPropertyOptional({ type: ResolutionProof }) resolutionProof?: ResolutionProof;
  @ApiPropertyOptional({ type: ResolutionVerification }) resolutionVerification?: ResolutionVerification;
  @ApiPropertyOptional({ type: ComplaintLocationSummary }) location?: ComplaintLocationSummary;
}
export class CreateCommunityComplaintDto {
  @ApiProperty({ enum: ComplaintType }) @IsEnum(ComplaintType) type!: ComplaintType;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) description!: string;
  @ApiProperty({ enum: WorkType }) @IsEnum(WorkType) requiredWorkType!: WorkType;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') apartmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') towerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') communityId?: string;
}
export class UpdateCommunityComplaintDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000) description?: string;
}
export class ComplaintStatusHistoryEntry {
  @ApiProperty({ enum: ComplaintStatus }) status!: ComplaintStatus;
  @ApiProperty() changedAt!: string;
  @ApiProperty() changedByRole!: string;
}
export class TransitionComplaintStatusDto {
  @ApiProperty({ enum: ComplaintStatus }) @IsEnum(ComplaintStatus) status!: ComplaintStatus;
}
export class AssignWorkerDto { @ApiProperty() @IsUUID('4') workerId!: string; }
export class WorkerActionDto {}
export class ResolveWorkDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) problemFound!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) resolutionSummary!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) proofAttachmentIds!: string[];
}
export class VerifyResolutionDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) authorityRating!: number;
}
export enum ComplaintAssignmentStatus { Assigned = 'ASSIGNED', InProgress = 'IN_PROGRESS', Completed = 'COMPLETED' }
export class ComplaintAssignment {
  @ApiProperty() id!: string;
  @ApiProperty() complaintId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty({ enum: ComplaintAssignmentStatus }) status!: ComplaintAssignmentStatus;
  @ApiProperty() assignedAt!: string;
  @ApiPropertyOptional() startedAt?: string;
  @ApiPropertyOptional() completedAt?: string;
}
export class ComplaintReview {
  @ApiProperty() id!: string;
  @ApiProperty() complaintId!: string;
  @ApiProperty() residentId!: string;
  @ApiProperty() workerId!: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating!: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) speedRating!: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) qualityRating!: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) communicationRating!: number;
  @ApiPropertyOptional() feedback?: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
export class CreateComplaintReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) speedRating!: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) qualityRating!: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) communicationRating!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000) feedback?: string;
}
