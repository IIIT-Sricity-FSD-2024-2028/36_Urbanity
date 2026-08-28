import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum WorkType {
  Plumbing = 'PLUMBING', Electrical = 'ELECTRICAL', Carpentry = 'CARPENTRY', Hvac = 'HVAC', LiftMaintenance = 'LIFT_MAINTENANCE', Cleaning = 'CLEANING', GeneralMaintenance = 'GENERAL_MAINTENANCE',
}
export enum WorkerStatus { Available = 'AVAILABLE', Busy = 'BUSY', OnLeave = 'ON_LEAVE', Inactive = 'INACTIVE' }

export class WorkerProfile {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() communityId!: string;
  @ApiProperty({ enum: WorkType }) specialization!: WorkType;
  @ApiProperty({ enum: WorkerStatus }) status!: WorkerStatus;
  @ApiProperty({ minimum: 0, maximum: 5 }) rating!: number;
  @ApiProperty({ minimum: 0 }) completedWorkCount!: number;
  @ApiProperty({ type: [String] }) workHistory!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
export class CreateWorkerProfileDto {
  @ApiProperty() @IsUUID('4') userId!: string;
  @ApiProperty({ enum: WorkType }) @IsEnum(WorkType) specialization!: WorkType;
  @ApiPropertyOptional({ enum: WorkerStatus, default: WorkerStatus.Available }) @IsOptional() @IsEnum(WorkerStatus) status?: WorkerStatus;
}
export class UpdateWorkerProfileDto extends PartialType(CreateWorkerProfileDto) {}
