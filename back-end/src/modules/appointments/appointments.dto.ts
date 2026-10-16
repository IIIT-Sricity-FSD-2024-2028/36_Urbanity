import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ComplaintStatus } from '../../common/enums/status.enum';

export enum AppointmentStatus {
  Requested = 'REQUESTED',
  Confirmed = 'CONFIRMED',
  RescheduleRequested = 'RESCHEDULE_REQUESTED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  Missed = 'MISSED',
}
export enum AppointmentAction {
  Requested = 'REQUESTED',
  RequestUpdated = 'REQUEST_UPDATED',
  Confirmed = 'CONFIRMED',
  RescheduleRequested = 'RESCHEDULE_REQUESTED',
  RescheduleApproved = 'RESCHEDULE_APPROVED',
  RescheduleDeclined = 'RESCHEDULE_DECLINED',
  Arrived = 'ARRIVED',
  Completed = 'COMPLETED',
  Missed = 'MISSED',
  Cancelled = 'CANCELLED',
}
export enum AppointmentTimeSlot {
  Slot0900 = '09:00-11:00',
  Slot1100 = '11:00-13:00',
  Slot1400 = '14:00-16:00',
  Slot1600 = '16:00-18:00',
}
export const TIME_SLOT_DEFINITIONS = Object.values(AppointmentTimeSlot).map((code) => {
  const [start, end] = code.split('-');
  return { code, start, end, label: `${start} – ${end}` };
});
export enum AppointmentOutcome { Completed = 'COMPLETED', Missed = 'MISSED' }
export enum RescheduleDecision { Approve = 'APPROVE', Decline = 'DECLINE' }

/** Active statuses hold (or request) a visit; at most one may exist per complaint. */
export const ACTIVE_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [AppointmentStatus.Requested, AppointmentStatus.Confirmed, AppointmentStatus.RescheduleRequested];
/** Statuses that reserve the worker's confirmed slot for conflict detection. */
export const SLOT_HOLDING_STATUSES: readonly AppointmentStatus[] = [AppointmentStatus.Confirmed, AppointmentStatus.RescheduleRequested];
/** Complaint statuses that still need on-site work and can therefore receive appointments. */
export const SCHEDULABLE_COMPLAINT_STATUSES: readonly ComplaintStatus[] = [ComplaintStatus.Submitted, ComplaintStatus.UnderReview, ComplaintStatus.Assigned, ComplaintStatus.InProgress];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Date must use the YYYY-MM-DD format';

export class AppointmentHistoryEntry {
  @ApiProperty({ enum: AppointmentAction }) action!: AppointmentAction;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty() changedAt!: string;
  @ApiProperty() changedByRole!: string;
  @ApiProperty() changedByUserId!: string;
  @ApiPropertyOptional() date?: string;
  @ApiPropertyOptional({ enum: AppointmentTimeSlot }) timeSlot?: AppointmentTimeSlot;
  @ApiPropertyOptional() previousDate?: string;
  @ApiPropertyOptional({ enum: AppointmentTimeSlot }) previousTimeSlot?: AppointmentTimeSlot;
  @ApiPropertyOptional() workerId?: string;
  @ApiPropertyOptional() note?: string;
}
export class AppointmentRescheduleRequest {
  @ApiProperty() proposedDate!: string;
  @ApiProperty({ enum: AppointmentTimeSlot }) proposedTimeSlot!: AppointmentTimeSlot;
  @ApiProperty() reason!: string;
  @ApiProperty() requestedAt!: string;
}
export class AppointmentVisitOutcome {
  @ApiProperty({ enum: AppointmentOutcome }) outcome!: AppointmentOutcome;
  @ApiProperty() notes!: string;
  @ApiProperty() followUpRequired!: boolean;
  @ApiProperty({ type: [String] }) attachmentIds!: string[];
  @ApiProperty() recordedAt!: string;
  @ApiProperty() recordedByRole!: string;
}
export class AppointmentCancellation {
  @ApiProperty() reason!: string;
  @ApiProperty() cancelledAt!: string;
  @ApiProperty() cancelledByRole!: string;
  @ApiProperty() cancelledByUserId!: string;
}
export class Appointment {
  @ApiProperty() id!: string;
  @ApiProperty() complaintId!: string;
  @ApiProperty() residentId!: string;
  @ApiProperty() communityId!: string;
  @ApiProperty() towerId!: string;
  @ApiProperty() apartmentId!: string;
  @ApiProperty({ enum: AppointmentStatus }) status!: AppointmentStatus;
  @ApiProperty() requestedDate!: string;
  @ApiProperty({ enum: AppointmentTimeSlot }) requestedTimeSlot!: AppointmentTimeSlot;
  @ApiPropertyOptional() residentNotes?: string;
  @ApiPropertyOptional() scheduledDate?: string;
  @ApiPropertyOptional({ enum: AppointmentTimeSlot }) scheduledTimeSlot?: AppointmentTimeSlot;
  @ApiPropertyOptional() workerId?: string;
  @ApiPropertyOptional() confirmedAt?: string;
  @ApiPropertyOptional({ type: AppointmentRescheduleRequest }) rescheduleRequest?: AppointmentRescheduleRequest;
  @ApiPropertyOptional() arrivedAt?: string;
  @ApiPropertyOptional({ type: AppointmentVisitOutcome }) outcome?: AppointmentVisitOutcome;
  @ApiPropertyOptional({ type: AppointmentCancellation }) cancellation?: AppointmentCancellation;
  @ApiProperty({ type: [AppointmentHistoryEntry] }) history!: AppointmentHistoryEntry[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class CreateAppointmentDto {
  @ApiProperty() @IsUUID('4') complaintId!: string;
  @ApiProperty({ example: '2026-10-20' }) @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) preferredDate!: string;
  @ApiProperty({ enum: AppointmentTimeSlot }) @IsEnum(AppointmentTimeSlot) timeSlot!: AppointmentTimeSlot;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(1000) notes?: string;
}
export class RequestRescheduleDto {
  @ApiProperty({ example: '2026-10-21' }) @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) preferredDate!: string;
  @ApiProperty({ enum: AppointmentTimeSlot }) @IsEnum(AppointmentTimeSlot) timeSlot!: AppointmentTimeSlot;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class CancelAppointmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class ConfirmAppointmentDto {
  @ApiProperty() @IsUUID('4') workerId!: string;
  @ApiPropertyOptional({ description: 'Defaults to the resident preferred date' }) @IsOptional() @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) scheduledDate?: string;
  @ApiPropertyOptional({ enum: AppointmentTimeSlot, description: 'Defaults to the resident preferred slot' }) @IsOptional() @IsEnum(AppointmentTimeSlot) timeSlot?: AppointmentTimeSlot;
}
export class RescheduleDecisionDto {
  @ApiProperty({ enum: RescheduleDecision }) @IsEnum(RescheduleDecision) decision!: RescheduleDecision;
  @ApiPropertyOptional({ description: 'Defaults to the resident proposed date when approving' }) @IsOptional() @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) scheduledDate?: string;
  @ApiPropertyOptional({ enum: AppointmentTimeSlot }) @IsOptional() @IsEnum(AppointmentTimeSlot) timeSlot?: AppointmentTimeSlot;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) note?: string;
}
export class RecordArrivalDto {}
export class RecordOutcomeDto {
  @ApiProperty({ enum: AppointmentOutcome }) @IsIn(Object.values(AppointmentOutcome)) outcome!: AppointmentOutcome;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) notes!: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() followUpRequired?: boolean;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUUID('4', { each: true }) attachmentIds?: string[];
}
export class MarkMissedDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
export class WorkerScheduleQueryDto {
  @ApiPropertyOptional({ example: '2026-10-20' }) @IsOptional() @Matches(DATE_PATTERN, { message: DATE_MESSAGE }) date?: string;
}
