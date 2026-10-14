import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CrudRepository } from '../../common/crud/crud.repository';
import { RoleName } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import {
  AmenityDto,
  BookingWindowDto,
  CreateBookingDto,
  MaintenanceBlockDto,
} from './amenities.dto';
import type {
  Amenity,
  AmenityBooking,
  BookingStatus,
  MaintenanceBlock,
} from './amenities.types';

const active = (b: AmenityBooking) =>
  b.status === 'APPROVED' || b.status === 'PENDING_APPROVAL';
const overlaps = (
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string },
) =>
  Date.parse(a.startsAt) < Date.parse(b.endsAt) &&
  Date.parse(b.startsAt) < Date.parse(a.endsAt);
const now = () => new Date().toISOString();
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

@Injectable()
export class AmenitiesService {
  private readonly amenities = new CrudRepository<Amenity>();
  private readonly bookings = new CrudRepository<AmenityBooking>();
  private readonly blocks = new CrudRepository<MaintenanceBlock>();
  constructor(private readonly communities: CommunityService) {}

  private scope(actor: AuthenticatedUser, admin = false) {
    if (actor.role === RoleName.CommunityAdmin)
      return this.communities.listCommunitiesForActor(actor)[0].id;
    if (!admin && actor.role === RoleName.Resident)
      return this.communities.resolveResidentHierarchy(actor.id).community.id;
    throw new ForbiddenException(
      'Only community administrators and residents may access amenities',
    );
  }
  private amenity(actor: AuthenticatedUser, id: string, admin = false) {
    const communityId = this.scope(actor, admin);
    const item = this.amenities.findById(id);
    if (!item) throw new NotFoundException('Amenity not found');
    if (item.communityId !== communityId)
      throw new ForbiddenException('Amenity belongs to another community');
    return item;
  }
  list(actor: AuthenticatedUser) {
    const communityId = this.scope(actor);
    return this.amenities
      .findAll()
      .filter((a) => a.communityId === communityId);
  }
  private validateConfig(dto: AmenityDto) {
    if (!dto.name.trim())
      throw new BadRequestException('Amenity name is required');
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.timeZone }).format();
    } catch {
      throw new BadRequestException('Use a valid IANA time zone');
    }
    if (minutes(dto.opensAt) >= minutes(dto.closesAt))
      throw new BadRequestException(
        'Closing time must follow opening time on the same day',
      );
    if (
      dto.minDurationMinutes > dto.maxDurationMinutes ||
      dto.minDurationMinutes > minutes(dto.closesAt) - minutes(dto.opensAt)
    )
      throw new BadRequestException('Invalid minimum or maximum duration');
  }
  create(actor: AuthenticatedUser, dto: AmenityDto) {
    const communityId = this.scope(actor, true);
    this.validateConfig(dto);
    return this.amenities.create({
      ...dto,
      name: dto.name.trim(),
      communityId,
      createdAt: now(),
      updatedAt: now(),
    });
  }
  update(actor: AuthenticatedUser, id: string, dto: AmenityDto) {
    const amenity = this.amenity(actor, id, true);
    this.validateConfig(dto);
    // Never silently invalidate accepted/pending reservations with a rule change.
    const rules = Object.keys(dto).filter(
      (k) => !['name', 'description', 'feeMinor', 'depositMinor'].includes(k),
    );
    if (
      rules.some(
        (k) => JSON.stringify(dto[k]) !== JSON.stringify(amenity[k]),
      ) &&
      this.bookings
        .findAll()
        .some(
          (b) =>
            b.amenityId === id &&
            active(b) &&
            Date.parse(b.endsAt) > Date.now(),
        )
    ) {
      throw new ConflictException(
        'Cancel or complete upcoming reservations before changing availability rules',
      );
    }
    return this.amenities.update(id, {
      ...dto,
      name: dto.name.trim(),
      updatedAt: now(),
    });
  }
  private window(startsAt: string, endsAt: string) {
    const start = Date.parse(startsAt),
      end = Date.parse(endsAt);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start <= Date.now() ||
      end <= start ||
      start % 60000 ||
      end % 60000
    )
      throw new BadRequestException(
        'Use future, whole-minute start and end times with end after start',
      );
    return { start, end };
  }
  private validateAvailability(
    a: Amenity,
    dto: BookingWindowDto,
    residentId?: string,
    excludeId?: string,
  ) {
    const { start, end } = this.window(dto.startsAt, dto.endsAt);
    if (a.status !== 'ACTIVE')
      throw new ConflictException('Amenity is inactive');
    if (start > Date.now() + a.advanceDays * 86400000)
      throw new BadRequestException(
        'Booking exceeds the advance booking window',
      );
    const duration = (end - start) / 60000;
    if (duration < a.minDurationMinutes || duration > a.maxDurationMinutes)
      throw new BadRequestException(
        'Booking duration is outside the allowed range',
      );
    if (
      !Number.isInteger(dto.attendees) ||
      dto.attendees < 1 ||
      dto.attendees > a.capacity
    )
      throw new BadRequestException('Attendees exceed amenity capacity');
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: a.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    const parts = (t: number) =>
      Object.fromEntries(
        formatter.formatToParts(t).map((p) => [p.type, p.value]),
      );
    const s = parts(start),
      e = parts(end);
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      s.weekday,
    );
    if (
      s.year !== e.year ||
      s.month !== e.month ||
      s.day !== e.day ||
      !a.weekdays.includes(day) ||
      Number(s.hour) * 60 + Number(s.minute) < minutes(a.opensAt) ||
      Number(e.hour) * 60 + Number(e.minute) > minutes(a.closesAt)
    )
      throw new BadRequestException('Reservation is outside operating hours');
    if (
      this.blocks
        .findAll()
        .some((b) => b.amenityId === a.id && !b.releasedAt && overlaps(b, dto))
    )
      throw new ConflictException('Amenity is blocked for maintenance');
    const reservations = this.bookings
      .findAll()
      .filter((b) => b.amenityId === a.id && active(b) && b.id !== excludeId);
    if (
      residentId &&
      reservations.filter(
        (b) => b.residentId === residentId && Date.parse(b.endsAt) > Date.now(),
      ).length >= a.maxActiveBookings
    )
      throw new ConflictException(
        'Maximum active bookings reached for this amenity',
      );
    const conflicting = reservations.filter((b) => overlaps(b, dto));
    if (a.exclusive && conflicting.length)
      throw new ConflictException('This time is already reserved');
    // Sweep only simultaneous occupancy; adjacent reservations do not overlap.
    const events = conflicting
      .flatMap((b) => [
        { at: Math.max(start, Date.parse(b.startsAt)), delta: b.attendees },
        { at: Math.min(end, Date.parse(b.endsAt)), delta: -b.attendees },
      ])
      .sort((x, y) => x.at - y.at || x.delta - y.delta);
    let occupied = dto.attendees;
    for (const event of events) {
      occupied += event.delta;
      if (occupied > a.capacity)
        throw new ConflictException('Insufficient capacity for this time');
    }
    return {
      available: true,
      feeMinor: a.feeMinor,
      depositMinor: a.depositMinor,
      currency: 'INR',
      requiresApproval: a.requiresApproval,
    };
  }
  availability(actor: AuthenticatedUser, id: string, dto: BookingWindowDto) {
    return this.validateAvailability(
      this.amenity(actor, id),
      dto,
      actor.role === RoleName.Resident ? actor.id : undefined,
    );
  }
  book(actor: AuthenticatedUser, id: string, dto: CreateBookingDto) {
    if (actor.role !== RoleName.Resident)
      throw new ForbiddenException('Only residents may reserve amenities');
    const a = this.amenity(actor, id);
    // Intentionally synchronous validation + write: one atomic event-loop operation for this in-memory store.
    this.validateAvailability(a, dto, actor.id);
    if (
      dto.expectedFeeMinor !== a.feeMinor ||
      dto.expectedDepositMinor !== a.depositMinor
    )
      throw new ConflictException(
        'Amenity fees changed. Refresh and review the current price',
      );
    const status = a.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';
    const paymentStatus =
      a.feeMinor + a.depositMinor > 0 ? 'PENDING' : 'NOT_REQUIRED';
    const at = now();
    return this.bookings.create({
      amenityId: id,
      amenityName: a.name,
      communityId: a.communityId,
      residentId: actor.id,
      apartmentId: this.communities.resolveResidentHierarchy(actor.id).apartment
        .id,
      startsAt: new Date(dto.startsAt).toISOString(),
      endsAt: new Date(dto.endsAt).toISOString(),
      attendees: dto.attendees,
      status,
      createdAt: at,
      feeMinor: a.feeMinor,
      depositMinor: a.depositMinor,
      currency: 'INR',
      paymentStatus,
      paymentHistory: [
        {
          at,
          status: paymentStatus,
          reason: 'Booking created; no payment collected',
        },
      ],
      history: [
        { at, actorId: actor.id, status, reason: 'Reservation created' },
      ],
    });
  }
  listBookings(actor: AuthenticatedUser) {
    const communityId = this.scope(actor);
    return this.bookings
      .findAll()
      .filter(
        (b) =>
          b.communityId === communityId &&
          (actor.role === RoleName.CommunityAdmin || b.residentId === actor.id),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  transition(
    actor: AuthenticatedUser,
    id: string,
    status: BookingStatus,
    reason: string,
  ) {
    const communityId = this.scope(actor, status !== 'CANCELLED');
    const b = this.bookings.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    if (
      b.communityId !== communityId ||
      (actor.role === RoleName.Resident && b.residentId !== actor.id)
    )
      throw new ForbiddenException('Booking access denied');
    if (!reason.trim()) throw new BadRequestException('A reason is required');
    if (
      !active(b) ||
      Date.parse(b.startsAt) <= Date.now() ||
      (status !== 'CANCELLED' && b.status !== 'PENDING_APPROVAL')
    )
      throw new ConflictException('This booking can no longer be changed');
    if (status === 'APPROVED')
      this.validateAvailability(
        this.amenity(actor, b.amenityId, true),
        b,
        undefined,
        b.id,
      );
    const at = now();
    const paymentStatus =
      status !== 'APPROVED' && b.paymentStatus === 'PENDING'
        ? 'VOIDED'
        : b.paymentStatus;
    return this.bookings.update(id, {
      status,
      paymentStatus,
      history: [
        ...b.history,
        { at, actorId: actor.id, status, reason: reason.trim() },
      ],
      paymentHistory:
        paymentStatus !== b.paymentStatus
          ? [
              ...b.paymentHistory,
              {
                at,
                status: paymentStatus,
                reason: 'Unpaid charge voided; no refund transaction',
              },
            ]
          : b.paymentHistory,
    });
  }
  listBlocks(actor: AuthenticatedUser, id: string) {
    this.amenity(actor, id);
    return this.blocks
      .findAll()
      .filter((b) => b.amenityId === id)
      .map((b) =>
        actor.role === RoleName.CommunityAdmin
          ? b
          : {
              id: b.id,
              startsAt: b.startsAt,
              endsAt: b.endsAt,
              releasedAt: b.releasedAt,
            },
      );
  }
  block(actor: AuthenticatedUser, id: string, dto: MaintenanceBlockDto) {
    const a = this.amenity(actor, id, true);
    this.window(dto.startsAt, dto.endsAt);
    if (!dto.reason.trim())
      throw new BadRequestException('A maintenance reason is required');
    if (
      this.bookings
        .findAll()
        .some((b) => b.amenityId === id && active(b) && overlaps(b, dto))
    )
      throw new ConflictException(
        'Cancel conflicting reservations before adding a maintenance block',
      );
    if (
      this.blocks
        .findAll()
        .some((b) => b.amenityId === id && !b.releasedAt && overlaps(b, dto))
    )
      throw new ConflictException('Maintenance blocks overlap');
    return this.blocks.create({
      ...dto,
      startsAt: new Date(dto.startsAt).toISOString(),
      endsAt: new Date(dto.endsAt).toISOString(),
      amenityId: id,
      communityId: a.communityId,
      createdAt: now(),
      createdBy: actor.id,
    });
  }
  releaseBlock(actor: AuthenticatedUser, id: string, blockId: string) {
    this.amenity(actor, id, true);
    const b = this.blocks.findById(blockId);
    if (!b || b.amenityId !== id)
      throw new NotFoundException('Maintenance block not found');
    if (b.releasedAt) throw new ConflictException('Block is already released');
    return this.blocks.update(blockId, {
      releasedAt: now(),
      releasedBy: actor.id,
    });
  }
}
