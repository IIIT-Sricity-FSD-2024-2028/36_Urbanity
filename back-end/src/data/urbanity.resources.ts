import { Type } from '@nestjs/common';
import { Identifiable } from '../common/crud/crud.repository';
import { RoleName } from '../common/enums/roles.enum';
import { hashSync } from 'bcryptjs';
import {
  Area,
  Assignment,
  Attachment,
  City,
  ComplaintUpdate,
  CreateAreaDto,
  CreateAssignmentDto,
  CreateAttachmentDto,
  CreateCityDto,
  CreateComplaintUpdateDto,
  CreateDepartmentDto,
  CreateFeedbackDto,
  CreateOfficeDto,
  CreateRoleDto,
  CreateSupportDto,
  CreateUserDto,
  Department,
  Feedback,
  Office,
  Role,
  Support,
  UpdateAreaDto,
  UpdateAssignmentDto,
  UpdateAttachmentDto,
  UpdateCityDto,
  UpdateComplaintUpdateDto,
  UpdateDepartmentDto,
  UpdateFeedbackDto,
  UpdateOfficeDto,
  UpdateRoleDto,
  UpdateSupportDto,
  UpdateUserDto,
  User,
} from './schemas';

export interface ResourceDefinition {
  name: string;
  path: string;
  tag: string;
  label: string;
  entity: Type<unknown>;
  createDto: Type<unknown>;
  updateDto: Type<unknown>;
  readRoles?: RoleName[];
  defaults?: () => Record<string, unknown>;
  seedData?: Identifiable[];
}

const now = () => new Date().toISOString();
const developmentPasswordHash = (password: string) => hashSync(password, 10);

export const SEEDED_ROLES = [
  { id: '00000000-0000-4000-8000-000000000001', name: RoleName.SuperAdmin },
  { id: '11111111-1111-4111-8111-111111111111', name: RoleName.CommunityAdmin },
  { id: '22222222-2222-4222-8222-222222222222', name: RoleName.TowerRepresentative },
  { id: '33333333-3333-4333-8333-333333333333', name: RoleName.Resident },
  { id: '44444444-4444-4444-8444-444444444444', name: RoleName.MaintenanceWorker },
];

export const SEEDED_USERS = [
  {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    name: 'Platform Super Admin',
    email: 'superadmin@urbanity.local',
    passwordHash: developmentPasswordHash('superadmin-dev'),
    role: RoleName.SuperAdmin,
    createdAt: now(),
  },
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Meera Shah',
    email: 'community.admin@urbanity.local',
    passwordHash: developmentPasswordHash('community-admin-dev'),
    role: RoleName.CommunityAdmin,
    communityId: '10000000-0000-4000-8000-000000000001',
    createdAt: now(),
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    name: 'Nisha Kapoor',
    email: 'community.admin.b@urbanity.local',
    passwordHash: developmentPasswordHash('community-admin-b-dev'),
    role: RoleName.CommunityAdmin,
    communityId: '10000000-0000-4000-8000-000000000002',
    createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    name: 'Arun Patel',
    email: 'tower.representative@urbanity.local',
    passwordHash: developmentPasswordHash('tower-representative-dev'),
    role: RoleName.TowerRepresentative,
    towerId: '20000000-0000-4000-8000-000000000001',
    createdAt: now(),
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    name: 'Vikram Bose',
    email: 'tower.representative.b@urbanity.local',
    passwordHash: developmentPasswordHash('tower-representative-b-dev'),
    role: RoleName.TowerRepresentative,
    towerId: '20000000-0000-4000-8000-000000000011',
    createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb8',
    name: 'Sana Iyer',
    email: 'tower.b.representative@urbanity.local',
    passwordHash: developmentPasswordHash('tower-b-representative-dev'),
    role: RoleName.TowerRepresentative,
    towerId: '20000000-0000-4000-8000-000000000002',
    createdAt: now(),
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
    name: 'Aditi Menon',
    email: 'resident.b@urbanity.local',
    passwordHash: developmentPasswordHash('resident-b-dev'),
    role: RoleName.Resident,
    apartmentId: '40000000-0000-4000-8000-000000000111',
    createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    name: 'Riya Nair',
    email: 'resident@urbanity.local',
    passwordHash: developmentPasswordHash('resident-dev'),
    role: RoleName.Resident,
    apartmentId: '40000000-0000-4000-8000-000000000011',
    createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    name: 'Devika Rao',
    email: 'resident.two@urbanity.local',
    passwordHash: developmentPasswordHash('resident-two-dev'),
    role: RoleName.Resident,
    apartmentId: '40000000-0000-4000-8000-000000000041',
    createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    name: 'Kabir Das',
    email: 'maintenance.worker@urbanity.local',
    passwordHash: developmentPasswordHash('maintenance-worker-dev'),
    role: RoleName.MaintenanceWorker,
    communityId: '10000000-0000-4000-8000-000000000001',
    createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5',
    name: 'Anil Kumar', email: 'worker.electrical@urbanity.local', passwordHash: developmentPasswordHash('worker-electrical-dev'), role: RoleName.MaintenanceWorker, communityId: '10000000-0000-4000-8000-000000000001', createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6',
    name: 'Kiran Singh', email: 'worker.general@urbanity.local', passwordHash: developmentPasswordHash('worker-general-dev'), role: RoleName.MaintenanceWorker, communityId: '10000000-0000-4000-8000-000000000001', createdAt: now(),
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb7',
    name: 'Manoj Das', email: 'worker-hvac@urbanity.local', passwordHash: developmentPasswordHash('worker-hvac-dev'), role: RoleName.MaintenanceWorker, communityId: '10000000-0000-4000-8000-000000000001', createdAt: now(),
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc5',
    name: 'Rahul Verma', email: 'maintenance.worker.b@urbanity.local', passwordHash: developmentPasswordHash('maintenance-worker-b-dev'), role: RoleName.MaintenanceWorker, communityId: '10000000-0000-4000-8000-000000000002', createdAt: now(),
  },
];

export const SEEDED_DEPARTMENTS = [
  {
    id: '11111111-aaaa-4aaa-8aaa-111111111111',
    name: 'Road',
    description: 'Road and civic infrastructure maintenance',
    manager: 'Amit Kumar',
    responseTime: '24',
  },
  {
    id: '22222222-aaaa-4aaa-8aaa-222222222222',
    name: 'Water Services',
    description: 'Water supply and utility services management',
    manager: 'Rajesh Sharma',
    responseTime: '18',
  },
  {
    id: '33333333-aaaa-4aaa-8aaa-333333333333',
    name: 'Sanitation',
    description: 'Waste management and cleanliness',
    manager: 'Sunita Rao',
    responseTime: '12',
  },
];

export const RESOURCES: ResourceDefinition[] = [
  {
    name: 'roles',
    path: 'roles',
    tag: 'roles',
    label: 'Role',
    entity: Role,
    createDto: CreateRoleDto,
    updateDto: UpdateRoleDto,
    seedData: SEEDED_ROLES,
  },
  {
    name: 'departments',
    path: 'departments',
    tag: 'departments',
    label: 'Department',
    entity: Department,
    createDto: CreateDepartmentDto,
    updateDto: UpdateDepartmentDto,
    seedData: SEEDED_DEPARTMENTS,
  },
  {
    name: 'offices',
    path: 'offices',
    tag: 'offices',
    label: 'Office',
    entity: Office,
    createDto: CreateOfficeDto,
    updateDto: UpdateOfficeDto,
  },
  {
    name: 'users',
    path: 'users',
    tag: 'users',
    label: 'User',
    entity: User,
    createDto: CreateUserDto,
    updateDto: UpdateUserDto,
    readRoles: [RoleName.CommunityAdmin],
    defaults: () => ({ createdAt: now() }),
    seedData: SEEDED_USERS,
  },
  {
    name: 'cities',
    path: 'cities',
    tag: 'cities',
    label: 'City',
    entity: City,
    createDto: CreateCityDto,
    updateDto: UpdateCityDto,
  },
  {
    name: 'areas',
    path: 'areas',
    tag: 'areas',
    label: 'Area',
    entity: Area,
    createDto: CreateAreaDto,
    updateDto: UpdateAreaDto,
  },
  {
    name: 'assignments',
    path: 'assignments',
    tag: 'assignments',
    label: 'Assignment',
    entity: Assignment,
    createDto: CreateAssignmentDto,
    updateDto: UpdateAssignmentDto,
    readRoles: [RoleName.CommunityAdmin],
    defaults: () => ({ assignedAt: now() }),
  },
  {
    name: 'complaint-updates',
    path: 'complaint-updates',
    tag: 'complaint-updates',
    label: 'Complaint update',
    entity: ComplaintUpdate,
    createDto: CreateComplaintUpdateDto,
    updateDto: UpdateComplaintUpdateDto,
    readRoles: [RoleName.CommunityAdmin],
    defaults: () => ({ updateTime: now() }),
  },
  {
    name: 'attachments',
    path: 'attachments',
    tag: 'attachments',
    label: 'Attachment',
    entity: Attachment,
    createDto: CreateAttachmentDto,
    updateDto: UpdateAttachmentDto,
    readRoles: [RoleName.CommunityAdmin],
    defaults: () => ({ uploadedAt: now() }),
  },
  {
    name: 'supports',
    path: 'supports',
    tag: 'supports',
    label: 'Support',
    entity: Support,
    createDto: CreateSupportDto,
    updateDto: UpdateSupportDto,
    readRoles: [RoleName.CommunityAdmin],
    defaults: () => ({ supportedAt: now() }),
  },
  {
    name: 'feedback',
    path: 'feedback',
    tag: 'feedback',
    label: 'Feedback',
    entity: Feedback,
    createDto: CreateFeedbackDto,
    updateDto: UpdateFeedbackDto,
    readRoles: [RoleName.CommunityAdmin],
    defaults: () => ({ submittedAt: now() }),
  },
];

export const repositoryToken = (name: string) =>
  `${name.toUpperCase()}_REPOSITORY`;
export const serviceToken = (name: string) => `${name.toUpperCase()}_SERVICE`;

export const resourceByName = (name: string): ResourceDefinition => {
  const resource = RESOURCES.find((item) => item.name === name);

  if (!resource) {
    throw new Error(`Resource "${name}" is not configured`);
  }

  return resource;
};
