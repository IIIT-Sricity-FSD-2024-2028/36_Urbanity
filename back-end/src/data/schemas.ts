import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ACTOR_ROLES = [
  'admin',
  'department-head',
  'department-officer',
  'field-worker',
  'citizen',
] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export class Role {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: 'citizen', maxLength: 50 })
  name!: string;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'citizen', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class Department {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: 'Waste Management', maxLength: 100 })
  name!: string;

  @ApiPropertyOptional({ example: 'Handles garbage collection complaints.' })
  description?: string;

  @ApiPropertyOptional({ example: 'waste@urbanity.gov', maxLength: 100 })
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+91-9876543210', maxLength: 20 })
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Amit Kumar' })
  manager?: string;

  @ApiPropertyOptional({ example: '24' })
  responseTime?: string;
}

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Waste Management', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Handles garbage collection complaints.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'waste@urbanity.gov', maxLength: 100 })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  contactEmail?: string;

  @ApiPropertyOptional({ example: '+91-9876543210', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Amit Kumar' })
  @IsOptional()
  @IsString()
  manager?: string;

  @ApiPropertyOptional({ example: '24' })
  @IsOptional()
  @IsString()
  responseTime?: string;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class City {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: 'Hyderabad', maxLength: 100 })
  name!: string;

  @ApiPropertyOptional({ example: 'Telangana', maxLength: 100 })
  state?: string;

  @ApiPropertyOptional({ example: 'India', maxLength: 100 })
  country?: string;
}

export class CreateCityDto {
  @ApiProperty({ example: 'Hyderabad', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Telangana', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'India', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class UpdateCityDto extends PartialType(CreateCityDto) {}

export class Area {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: 'Ward 12', maxLength: 100 })
  name!: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  cityId?: string;
}

export class CreateAreaDto {
  @ApiProperty({ example: 'Ward 12', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  cityId?: string;
}

export class UpdateAreaDto extends PartialType(CreateAreaDto) {}

export class Office {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: 'Central Zone Office', maxLength: 100 })
  name!: string;

  @ApiPropertyOptional({ example: 'Main Road, Central Zone' })
  address?: string;

  @ApiPropertyOptional({ example: '+91-9876543210', maxLength: 20 })
  contactPhone?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  departmentId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  areaId?: string;
}

export class CreateOfficeDto {
  @ApiProperty({ example: 'Central Zone Office', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Main Road, Central Zone' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+91-9876543210', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;
}

export class UpdateOfficeDto extends PartialType(CreateOfficeDto) {}

export class User {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: 'Asha Rao', maxLength: 100 })
  name!: string;

  @ApiProperty({ example: 'asha@example.com', maxLength: 100 })
  email!: string;

  @ApiProperty({ example: 'hashed-password-value', maxLength: 255 })
  passwordHash!: string;

  @ApiPropertyOptional({ example: '+91-9876543210', maxLength: 20 })
  phone?: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  roleId!: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  officeId?: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: 'Road' })
  department?: string;

  @ApiPropertyOptional({ example: 'Active' })
  status?: string;

  @ApiPropertyOptional({ example: 'Just now' })
  lastActive?: string;

  @ApiPropertyOptional({ example: 'DH-001' })
  employeeCode?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  reportsTo?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  headId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  officerId?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Asha Rao', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'asha@example.com', maxLength: 100 })
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @ApiProperty({ example: 'hashed-password-value', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  passwordHash!: string;

  @ApiPropertyOptional({ example: '+91-9876543210', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('4')
  roleId!: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  officeId?: string;

  @ApiPropertyOptional({ example: 'Road' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Just now' })
  @IsOptional()
  @IsString()
  lastActive?: string;

  @ApiPropertyOptional({ example: 'DH-001' })
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsString()
  reportsTo?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsString()
  headId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsString()
  officerId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export const COMPLAINT_STATUSES = [
  'Pending',
  'In Progress',
  'Resolved',
  'Closed',
] as const;

export class Complaint {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  citizenId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  departmentId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  officeId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  areaId?: string;

  @ApiProperty({ example: 'Streetlight not working', maxLength: 200 })
  title!: string;

  @ApiPropertyOptional({ example: 'The streetlight near park gate is out.' })
  description?: string;

  @ApiProperty({ enum: COMPLAINT_STATUSES, example: 'Pending' })
  status!: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: 'Oak Street' })
  location?: string;

  @ApiPropertyOptional({ example: 'Roads' })
  category?: string;

  @ApiPropertyOptional({ example: 'Road' })
  department?: string;

  @ApiPropertyOptional({ example: 'Anita Rao' })
  reportedBy?: string;

  @ApiPropertyOptional({ example: 'anita.rao@urbanity.gov' })
  reportedByEmail?: string;

  @ApiPropertyOptional({ example: 3 })
  upvotes?: number;

  @ApiPropertyOptional({ example: ['id:user-id'] })
  upvotedBy?: string[];

  @ApiPropertyOptional({ example: [] })
  media?: unknown[];

  @ApiPropertyOptional({ example: [] })
  resolutionMedia?: unknown[];

  @ApiPropertyOptional({ example: '2026-05-03' })
  date?: string;

  @ApiPropertyOptional({ example: { rating: 5, comments: 'Great work.' } })
  feedback?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-05-03T09:30:00.000Z' })
  feedbackSubmittedAt?: string;
}

export class CreateComplaintDto {
  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  citizenId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  departmentId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  officeId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiProperty({ example: 'Streetlight not working', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'The streetlight near park gate is out.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: COMPLAINT_STATUSES, example: 'Pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Oak Street' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Roads' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Road' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Anita Rao' })
  @IsOptional()
  @IsString()
  reportedBy?: string;

  @ApiPropertyOptional({ example: 'anita.rao@urbanity.gov' })
  @IsOptional()
  @IsEmail()
  reportedByEmail?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  upvotes?: number;

  @ApiPropertyOptional({ example: ['id:user-id'] })
  @IsOptional()
  upvotedBy?: string[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  media?: unknown[];

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  resolutionMedia?: unknown[];

  @ApiPropertyOptional({ example: '2026-05-03' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ example: { rating: 5, comments: 'Great work.' } })
  @IsOptional()
  feedback?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-05-03T09:30:00.000Z' })
  @IsOptional()
  @IsString()
  feedbackSubmittedAt?: string;
}

export class UpdateComplaintDto extends PartialType(CreateComplaintDto) {}

export class Assignment {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  complaintId!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  assignedBy!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  workerId!: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  assignedAt!: string;

  @ApiPropertyOptional({ example: 'Ravi Verma' })
  assignee?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'Priya Sharma' })
  officer?: string;

  @ApiPropertyOptional({ example: 'Road' })
  department?: string;

  @ApiPropertyOptional({ example: 'Assigned' })
  status?: string;

  @ApiPropertyOptional({ example: 'Medium' })
  priority?: string;

  @ApiPropertyOptional({ example: '2026-05-03' })
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Inspect and resolve the issue.' })
  notes?: string;

  @ApiPropertyOptional({ example: [] })
  proofMedia?: unknown[];

  @ApiPropertyOptional({ example: '2026-05-03T09:30:00.000Z' })
  verifiedAt?: string;

  @ApiPropertyOptional({ example: 'Streetlight not working' })
  issueDescription?: string;

  @ApiPropertyOptional({ example: 'Roads' })
  category?: string;

  @ApiPropertyOptional({ example: 'Oak Street' })
  location?: string;

  @ApiPropertyOptional({ example: '2026-05-03' })
  assignedDate?: string;

  @ApiPropertyOptional({ example: 'Inspect and resolve the issue.' })
  details?: string;

  @ApiPropertyOptional({ example: 'Anita Rao' })
  citizenName?: string;

  @ApiPropertyOptional({ example: 'anita.rao@urbanity.gov' })
  citizenContact?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  officerId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  headId?: string;

  @ApiPropertyOptional({ example: 'Work completed on site.' })
  remarks?: string;

  @ApiPropertyOptional({ example: 'Repaired the damaged road patch.' })
  workDetails?: string;

  @ApiPropertyOptional({ example: 'Asphalt mix' })
  materials?: string;

  @ApiPropertyOptional({ example: '2026-05-03T09:30:00.000Z' })
  completedAt?: string;
}

export class CreateAssignmentDto {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  @IsNotEmpty()
  complaintId!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  assignedBy!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  workerId!: string;

  @ApiPropertyOptional({ example: 'Ravi Verma' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ example: 'Priya Sharma' })
  @IsOptional()
  @IsString()
  officer?: string;

  @ApiPropertyOptional({ example: 'Road' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Assigned' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Medium' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: '2026-05-03' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Inspect and resolve the issue.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: [] })
  @IsOptional()
  proofMedia?: unknown[];

  @ApiPropertyOptional({ example: '2026-05-03T09:30:00.000Z' })
  @IsOptional()
  @IsString()
  verifiedAt?: string;

  @ApiPropertyOptional({ example: 'Streetlight not working' })
  @IsOptional()
  @IsString()
  issueDescription?: string;

  @ApiPropertyOptional({ example: 'Roads' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Oak Street' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '2026-05-03' })
  @IsOptional()
  @IsString()
  assignedDate?: string;

  @ApiPropertyOptional({ example: 'Inspect and resolve the issue.' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ example: 'Anita Rao' })
  @IsOptional()
  @IsString()
  citizenName?: string;

  @ApiPropertyOptional({ example: 'anita.rao@urbanity.gov' })
  @IsOptional()
  @IsString()
  citizenContact?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsString()
  officerId?: string;

  @ApiPropertyOptional({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsOptional()
  @IsString()
  headId?: string;

  @ApiPropertyOptional({ example: 'Work completed on site.' })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({ example: 'Repaired the damaged road patch.' })
  @IsOptional()
  @IsString()
  workDetails?: string;

  @ApiPropertyOptional({ example: 'Asphalt mix' })
  @IsOptional()
  @IsString()
  materials?: string;

  @ApiPropertyOptional({ example: '2026-05-03T09:30:00.000Z' })
  @IsOptional()
  @IsString()
  completedAt?: string;
}

export class UpdateAssignmentDto extends PartialType(CreateAssignmentDto) {}

export class ComplaintUpdate {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  complaintId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  updateNo!: number;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  updatedBy!: string;

  @ApiPropertyOptional({ example: 'Inspection completed by field worker.' })
  updateMessage?: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  updateTime!: string;
}

export class CreateComplaintUpdateDto {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  @IsNotEmpty()
  complaintId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  updateNo!: number;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  @IsNotEmpty()
  updatedBy!: string;

  @ApiPropertyOptional({ example: 'Inspection completed by field worker.' })
  @IsOptional()
  @IsString()
  updateMessage?: string;
}

export class UpdateComplaintUpdateDto extends PartialType(
  CreateComplaintUpdateDto,
) {}

export class Attachment {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  complaintId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  attachmentNo!: number;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  userId!: string;

  @ApiPropertyOptional({ example: 'https://example.com/uploads/photo.jpg' })
  fileUrl?: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  uploadedAt!: string;
}

export class CreateAttachmentDto {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsUUID('4')
  complaintId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  attachmentNo!: number;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsUUID('4')
  userId!: string;

  @ApiPropertyOptional({ example: 'https://example.com/uploads/photo.jpg' })
  @IsOptional()
  @IsUrl()
  fileUrl?: string;
}

export class UpdateAttachmentDto extends PartialType(CreateAttachmentDto) {}

export class Support {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  complaintId!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  userId!: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  supportedAt!: string;
}

export class CreateSupportDto {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsUUID('4')
  complaintId!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsUUID('4')
  userId!: string;
}

export class UpdateSupportDto extends PartialType(CreateSupportDto) {}

export class Feedback {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  id!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  complaintId!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  userId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating!: number;

  @ApiPropertyOptional({ example: 'The issue was resolved quickly.' })
  comments?: string;

  @ApiProperty({ example: '2026-05-03T09:30:00.000Z' })
  submittedAt!: string;
}

export class CreateFeedbackDto {
  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  @IsNotEmpty()
  complaintId!: string;

  @ApiProperty({ example: '7b9f22cf-bbd3-4cc9-8d75-f21f02835b74' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'The issue was resolved quickly.' })
  @IsOptional()
  @IsString()
  comments?: string;
}

export class UpdateFeedbackDto extends PartialType(CreateFeedbackDto) {}
