import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { Apartment, AssociateApartmentDto, AssociateTowerDto, Community, CreateApartmentDto, CreateCommunityDto, CreateFloorDto, CreateTowerDto, Floor, Tower, UpdateApartmentDto, UpdateCommunityDto, UpdateFloorDto, UpdateTowerDto } from './hierarchy.dto';

const timestamp = () => new Date().toISOString();
const seedTime = '2026-01-01T00:00:00.000Z';
const communities: Community[] = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Green Valley Apartments', address: 'Green Valley Road, Sricity', description: 'Development community A', createdAt: seedTime, updatedAt: seedTime },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Blue Horizon Residency', address: 'Blue Horizon Road, Sricity', description: 'Development community B', createdAt: seedTime, updatedAt: seedTime },
];
const towers: Tower[] = [
  ...['A', 'B', 'C'].map((code, index) => ({ id: `20000000-0000-4000-8000-00000000000${index + 1}`, communityId: communities[0].id, name: `Tower ${code}`, code, createdAt: seedTime, updatedAt: seedTime })),
  ...['A', 'B'].map((code, index) => ({ id: `20000000-0000-4000-8000-00000000001${index + 1}`, communityId: communities[1].id, name: `Tower ${code}`, code, createdAt: seedTime, updatedAt: seedTime })),
];
const communityATowers = towers.filter((tower) => tower.communityId === communities[0].id);
const communityBTowers = towers.filter((tower) => tower.communityId === communities[1].id);
const floors: Floor[] = [
  ...communityATowers.flatMap((tower, towerIndex) => [1, 2].map((floorNumber) => ({ id: `30000000-0000-4000-8000-0000000000${towerIndex + 1}${floorNumber}`, towerId: tower.id, floorNumber, label: `Floor ${floorNumber}`, createdAt: seedTime, updatedAt: seedTime }))),
  ...communityBTowers.flatMap((tower, towerIndex) => [1, 2].map((floorNumber) => ({ id: `30000000-0000-4000-8000-0000000001${towerIndex + 1}${floorNumber}`, towerId: tower.id, floorNumber, label: `Floor ${floorNumber}`, createdAt: seedTime, updatedAt: seedTime }))),
];
const apartments: Apartment[] = [
  ...floors.filter((floor) => communityATowers.some((tower) => tower.id === floor.towerId)).flatMap((floor, index) => [1, 2].map((unit) => { const tower = communityATowers.find((item) => item.id === floor.towerId)!; const number = `${tower.code}-${floor.floorNumber}${String(unit).padStart(2, '0')}`; return { id: `40000000-0000-4000-8000-0000000000${index + 1}${unit}`, floorId: floor.id, apartmentNumber: number, label: number, createdAt: seedTime, updatedAt: seedTime }; })),
  ...floors.filter((floor) => communityBTowers.some((tower) => tower.id === floor.towerId)).flatMap((floor, index) => [1, 2].map((unit) => { const tower = communityBTowers.find((item) => item.id === floor.towerId)!; const number = `${tower.code}-${floor.floorNumber}${String(unit).padStart(2, '0')}`; return { id: `40000000-0000-4000-8000-0000000001${index + 1}${unit}`, floorId: floor.id, apartmentNumber: number, label: number, createdAt: seedTime, updatedAt: seedTime }; })),
];

@Injectable()
export class CommunityService {
  private readonly communityRepo = new CrudRepository(communities);
  private readonly towerRepo = new CrudRepository(towers);
  private readonly floorRepo = new CrudRepository(floors);
  private readonly apartmentRepo = new CrudRepository(apartments);
  private readonly communityCrud = new CrudService(this.communityRepo, 'Community');
  private readonly towerCrud = new CrudService(this.towerRepo, 'Tower');
  private readonly floorCrud = new CrudService(this.floorRepo, 'Floor');
  private readonly apartmentCrud = new CrudService(this.apartmentRepo, 'Apartment');

  constructor(@Inject(serviceToken('users')) private readonly users: CrudService<User, any, any>) {}
  listCommunities() { return this.communityCrud.findAll(); } getCommunity(id: string) { return this.communityCrud.findById(id); }
  listCommunitiesForActor(actor: AuthenticatedUser) { return actor.role === RoleName.SuperAdmin ? this.listCommunities() : [this.requireScopedCommunity(actor)]; }
  getCommunityForActor(actor: AuthenticatedUser, id: string) { const community = this.getCommunity(id); this.assertCommunityAccess(actor, community.id); return community; }
  createCommunity(dto: CreateCommunityDto) { const now = timestamp(); return this.communityCrud.create({ ...dto, createdAt: now, updatedAt: now }); }
  createCommunityForActor(actor: AuthenticatedUser, dto: CreateCommunityDto) { this.requireSuperAdmin(actor); return this.createCommunity(dto); }
  updateCommunity(id: string, dto: UpdateCommunityDto) { return this.communityCrud.update(id, { ...dto, updatedAt: timestamp() }); }
  updateCommunityForActor(actor: AuthenticatedUser, id: string, dto: UpdateCommunityDto) { this.requireSuperAdmin(actor); return this.updateCommunity(id, dto); }
  deleteCommunity(id: string) { this.ensureNoChildren(this.towerCrud.findAll().some((tower) => tower.communityId === id), 'Community has towers and cannot be deleted'); return this.communityCrud.delete(id); }
  deleteCommunityForActor(actor: AuthenticatedUser, id: string) { this.requireSuperAdmin(actor); return this.deleteCommunity(id); }
  listTowers() { return this.towerCrud.findAll(); } getTower(id: string) { return this.towerCrud.findById(id); }
  listTowersForActor(actor: AuthenticatedUser) { return this.listTowers().filter((tower) => this.canAccessCommunity(actor, tower.communityId)); }
  getTowerForActor(actor: AuthenticatedUser, id: string) { const tower = this.getTower(id); this.assertCommunityAccess(actor, tower.communityId); return tower; }
  createTower(dto: CreateTowerDto) { this.getCommunity(dto.communityId); this.unique(this.towerCrud.findAll(), dto.communityId, dto.code, 'communityId', 'code', 'Tower code'); const now = timestamp(); return this.towerCrud.create({ ...dto, createdAt: now, updatedAt: now }); }
  createTowerForActor(actor: AuthenticatedUser, dto: CreateTowerDto) { this.assertCommunityAccess(actor, dto.communityId); return this.createTower(dto); }
  updateTower(id: string, dto: UpdateTowerDto) { const current = this.getTower(id); const next = { ...current, ...dto }; this.getCommunity(next.communityId); this.unique(this.towerCrud.findAll().filter((item) => item.id !== id), next.communityId, next.code, 'communityId', 'code', 'Tower code'); return this.towerCrud.update(id, { ...dto, updatedAt: timestamp() }); }
  updateTowerForActor(actor: AuthenticatedUser, id: string, dto: UpdateTowerDto) { this.assertCommunityAccess(actor, this.getTower(id).communityId); if (dto.communityId) this.assertCommunityAccess(actor, dto.communityId); return this.updateTower(id, dto); }
  deleteTower(id: string) { this.ensureNoChildren(this.floorCrud.findAll().some((floor) => floor.towerId === id), 'Tower has floors and cannot be deleted'); return this.towerCrud.delete(id); }
  deleteTowerForActor(actor: AuthenticatedUser, id: string) { this.assertCommunityAccess(actor, this.getTower(id).communityId); return this.deleteTower(id); }
  listFloors() { return this.floorCrud.findAll(); } getFloor(id: string) { return this.floorCrud.findById(id); }
  listFloorsForActor(actor: AuthenticatedUser) { return this.listFloors().filter((floor) => this.canAccessCommunity(actor, this.getTower(floor.towerId).communityId)); }
  getFloorForActor(actor: AuthenticatedUser, id: string) { const floor = this.getFloor(id); this.assertCommunityAccess(actor, this.getTower(floor.towerId).communityId); return floor; }
  createFloor(dto: CreateFloorDto) { this.getTower(dto.towerId); this.unique(this.floorCrud.findAll(), dto.towerId, dto.floorNumber, 'towerId', 'floorNumber', 'Floor number'); const now = timestamp(); return this.floorCrud.create({ ...dto, createdAt: now, updatedAt: now }); }
  createFloorForActor(actor: AuthenticatedUser, dto: CreateFloorDto) { this.assertCommunityAccess(actor, this.getTower(dto.towerId).communityId); return this.createFloor(dto); }
  updateFloor(id: string, dto: UpdateFloorDto) { const current = this.getFloor(id); const next = { ...current, ...dto }; this.getTower(next.towerId); this.unique(this.floorCrud.findAll().filter((item) => item.id !== id), next.towerId, next.floorNumber, 'towerId', 'floorNumber', 'Floor number'); return this.floorCrud.update(id, { ...dto, updatedAt: timestamp() }); }
  updateFloorForActor(actor: AuthenticatedUser, id: string, dto: UpdateFloorDto) { this.assertCommunityAccess(actor, this.getTower(this.getFloor(id).towerId).communityId); if (dto.towerId) this.assertCommunityAccess(actor, this.getTower(dto.towerId).communityId); return this.updateFloor(id, dto); }
  deleteFloor(id: string) { this.ensureNoChildren(this.apartmentCrud.findAll().some((apartment) => apartment.floorId === id), 'Floor has apartments and cannot be deleted'); return this.floorCrud.delete(id); }
  deleteFloorForActor(actor: AuthenticatedUser, id: string) { this.assertCommunityAccess(actor, this.getTower(this.getFloor(id).towerId).communityId); return this.deleteFloor(id); }
  listApartments() { return this.apartmentCrud.findAll(); } getApartment(id: string) { return this.apartmentCrud.findById(id); }
  listApartmentsForActor(actor: AuthenticatedUser) { return this.listApartments().filter((apartment) => this.canAccessCommunity(actor, this.getTower(this.getFloor(apartment.floorId).towerId).communityId)); }
  getApartmentForActor(actor: AuthenticatedUser, id: string) { const apartment = this.getApartment(id); this.assertCommunityAccess(actor, this.getTower(this.getFloor(apartment.floorId).towerId).communityId); return apartment; }
  createApartment(dto: CreateApartmentDto) { this.getFloor(dto.floorId); this.unique(this.apartmentCrud.findAll(), dto.floorId, dto.apartmentNumber, 'floorId', 'apartmentNumber', 'Apartment number'); const now = timestamp(); return this.apartmentCrud.create({ ...dto, createdAt: now, updatedAt: now }); }
  createApartmentForActor(actor: AuthenticatedUser, dto: CreateApartmentDto) { this.assertCommunityAccess(actor, this.getTower(this.getFloor(dto.floorId).towerId).communityId); return this.createApartment(dto); }
  updateApartment(id: string, dto: UpdateApartmentDto) { const current = this.getApartment(id); const next = { ...current, ...dto }; this.getFloor(next.floorId); this.unique(this.apartmentCrud.findAll().filter((item) => item.id !== id), next.floorId, next.apartmentNumber, 'floorId', 'apartmentNumber', 'Apartment number'); return this.apartmentCrud.update(id, { ...dto, updatedAt: timestamp() }); }
  updateApartmentForActor(actor: AuthenticatedUser, id: string, dto: UpdateApartmentDto) { this.assertCommunityAccess(actor, this.getTower(this.getFloor(this.getApartment(id).floorId).towerId).communityId); if (dto.floorId) this.assertCommunityAccess(actor, this.getTower(this.getFloor(dto.floorId).towerId).communityId); return this.updateApartment(id, dto); }
  deleteApartment(id: string) { this.ensureNoChildren(this.users.findAll().some((user) => user.apartmentId === id), 'Apartment has associated residents and cannot be deleted'); return this.apartmentCrud.delete(id); }
  deleteApartmentForActor(actor: AuthenticatedUser, id: string) { this.assertCommunityAccess(actor, this.getTower(this.getFloor(this.getApartment(id).floorId).towerId).communityId); return this.deleteApartment(id); }
  associateResident(actor: AuthenticatedUser, userId: string, dto: AssociateApartmentDto) { this.requireCommunityAdmin(actor); const user = this.users.findById(userId); if (user.role !== RoleName.Resident) throw new BadRequestException('Only RESIDENT users can be associated with apartments'); const apartment = this.getApartment(dto.apartmentId); this.assertCommunityAccess(actor, this.getTower(this.getFloor(apartment.floorId).towerId).communityId); this.assertTargetUserAccess(actor, user); return this.users.update(userId, { apartmentId: dto.apartmentId }); }
  associateRepresentative(actor: AuthenticatedUser, userId: string, dto: AssociateTowerDto) { this.requireCommunityAdmin(actor); const user = this.users.findById(userId); if (user.role !== RoleName.TowerRepresentative) throw new BadRequestException('Only TOWER_REPRESENTATIVE users can be associated with towers'); const tower = this.getTower(dto.towerId); this.assertCommunityAccess(actor, tower.communityId); this.assertTargetUserAccess(actor, user); return this.users.update(userId, { towerId: dto.towerId }); }
  resolveOwnHierarchy(actor: AuthenticatedUser) {
    if (actor.role === RoleName.Resident) return this.resolveResidentHierarchyForActor(actor, actor.id);
    if (actor.role === RoleName.TowerRepresentative) {
      const user = this.users.findById(actor.id);
      if (!user.towerId) throw new NotFoundException('Tower Representative association was not found');
      const tower = this.getTower(user.towerId);
      return { user: this.safeUser(user), tower, community: this.getCommunity(tower.communityId) };
    }
    throw new ForbiddenException('This user does not have a hierarchy association');
  }
  resolveResidentHierarchy(userId: string) {
    const user = this.users.findById(userId);
    if (user.role !== RoleName.Resident || !user.apartmentId) throw new NotFoundException('Resident apartment association was not found');
    const apartment = this.getApartment(user.apartmentId);
    const floor = this.getFloor(apartment.floorId);
    const tower = this.getTower(floor.towerId);
    return { user, apartment, floor, tower, community: this.getCommunity(tower.communityId) };
  }
  resolveResidentHierarchyForActor(actor: AuthenticatedUser, userId: string) {
    const hierarchy = this.resolveResidentHierarchy(userId);
    const { user, apartment, floor, tower, community } = hierarchy;
    if (actor.role === RoleName.Resident && actor.id !== userId) throw new ForbiddenException('Residents may inspect only their own hierarchy');
    if (actor.role === RoleName.TowerRepresentative) {
      const representative = this.users.findById(actor.id);
      if (representative.towerId !== tower.id) throw new ForbiddenException('Tower Representatives may inspect only their own tower');
    }
    if (![RoleName.CommunityAdmin, RoleName.Resident, RoleName.TowerRepresentative].includes(actor.role)) throw new ForbiddenException('Insufficient hierarchy permissions');
    return { user: this.safeUser(user), apartment, floor, tower, community };
  }
  private requireCommunityAdmin(actor: AuthenticatedUser) { if (![RoleName.CommunityAdmin, RoleName.SuperAdmin].includes(actor.role)) throw new ForbiddenException('Only Community Admins or Super Admins may manage hierarchy associations'); }
  private requireSuperAdmin(actor: AuthenticatedUser) { if (actor.role !== RoleName.SuperAdmin) throw new ForbiddenException('Only Super Admins may manage communities'); }
  private requireScopedCommunity(actor: AuthenticatedUser) { const user = this.users.findById(actor.id); if (actor.role !== RoleName.CommunityAdmin || !user.communityId) throw new ForbiddenException('Community access is restricted'); return this.getCommunity(user.communityId); }
  private canAccessCommunity(actor: AuthenticatedUser, communityId: string) { return actor.role === RoleName.SuperAdmin || (actor.role === RoleName.CommunityAdmin && this.users.findById(actor.id).communityId === communityId); }
  private assertCommunityAccess(actor: AuthenticatedUser, communityId: string) { if (!this.canAccessCommunity(actor, communityId)) throw new ForbiddenException('You do not have access to this community'); }
  private assertTargetUserAccess(actor: AuthenticatedUser, user: User) { if (actor.role === RoleName.SuperAdmin || !user.apartmentId && !user.towerId && user.communityId === this.users.findById(actor.id).communityId) return; if (user.towerId && this.getTower(user.towerId).communityId === this.users.findById(actor.id).communityId) return; if (user.apartmentId && this.getTower(this.getFloor(this.getApartment(user.apartmentId).floorId).towerId).communityId === this.users.findById(actor.id).communityId) return; throw new ForbiddenException('Target user belongs to another community'); }
  private safeUser(user: User) { const { passwordHash: _passwordHash, ...safeUser } = user; return safeUser; }
  private unique<T extends Record<string, any>>(items: T[], parent: unknown, value: unknown, parentKey: keyof T, valueKey: keyof T, label: string) { if (items.some((item) => item[parentKey] === parent && item[valueKey] === value)) throw new BadRequestException(`${label} must be unique within its parent`); }
  private ensureNoChildren(hasChildren: boolean, message: string) { if (hasChildren) throw new BadRequestException(message); }
}
