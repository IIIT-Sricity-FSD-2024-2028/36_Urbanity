import { randomUUID } from 'crypto';
import { extensionFeeMinor } from './amenities.pricing';
import {
  clockMinutes,
  dayInstants,
  instant,
  localParts,
  validDate,
} from './amenities.time';
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
  ChangeBookingDto,
  ChangeAvailabilityDto,
  DayAvailabilityDto,
  BookingWindowDto,
  CreateBookingDto,
  MaintenanceBlockDto,
} from './amenities.dto';
import type {
  Amenity,
  AmenityBooking,
  BookingChange,
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
const minutes = clockMinutes;

@Injectable()
export class AmenitiesService {
  private readonly amenities = new CrudRepository<Amenity>();
  private readonly bookings = new CrudRepository<AmenityBooking>();
  private readonly creationRetries = new Map<
    string,
    { fingerprint: string; id: string }
  >();
  private readonly blocks = new CrudRepository<MaintenanceBlock>();
  constructor(private readonly communities: CommunityService) {
    this.communities.registerOccupancyBlocker?.(
      'amenities',
      (apartmentId, start, end) =>
        this.bookings
          .findAll()
          .some(
            (b) =>
              b.apartmentId === apartmentId &&
              active(b) &&
              this.heldIntervals(b, 0).some(
                (w) => w.start < Date.parse(end) && Date.parse(start) < w.end,
              ),
          )
          ? 'Resolve or explicitly cancel conflicting amenity reservations before activating tenancy; charges are not automatically refunded'
          : undefined,
    );
  }

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
    if (actor.role === RoleName.Resident)
      this.communities.resolveResidentOccupancy?.(actor.id);
    const communityId = this.scope(actor);
    return this.amenities
      .findAll()
      .filter((a) => a.communityId === communityId);
  }
  private config(dto: AmenityDto) {
    return {
      ...dto,
      bookingIntervalMinutes: dto.bookingIntervalMinutes ?? 1,
      turnaroundMinutes: dto.turnaroundMinutes ?? 0,
      allowExtensions: dto.allowExtensions ?? false,
      cancellationCutoffMinutes: dto.cancellationCutoffMinutes ?? 0,
    };
  }
  private validateConfig(dto: AmenityDto) {
    if (
      !Number.isInteger(dto.advanceDays) ||
      dto.advanceDays < 0 ||
      dto.advanceDays > 365
    )
      throw new BadRequestException(
        'Minimum booking notice must be from 0 to 365 days',
      );
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
    const shortestSlot =
      Math.ceil(dto.minDurationMinutes / dto.bookingIntervalMinutes) *
      dto.bookingIntervalMinutes;
    if (
      shortestSlot > dto.maxDurationMinutes ||
      shortestSlot > minutes(dto.closesAt) - minutes(dto.opensAt)
    )
      throw new BadRequestException(
        'Booking interval must permit a duration within the configured limits and opening hours',
      );
  }
  create(actor: AuthenticatedUser, dto: AmenityDto) {
    const communityId = this.scope(actor, true);
    dto = this.config(dto);
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
    dto = this.config(dto);
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
  private window(startsAt: string, endsAt: string, allowStarted = false) {
    const start = instant(startsAt),
      end = instant(endsAt);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      (!allowStarted && start <= Date.now()) ||
      end <= Date.now() ||
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
    allowStarted = false,
    skipNotice = false,
  ) {
    const { start, end } = this.window(dto.startsAt, dto.endsAt, allowStarted);
    if (residentId && this.communities.resolveResidentOccupancy)
      this.communities.resolveResidentOccupancy(
        residentId,
        excludeId ? this.bookings.findById(excludeId)?.apartmentId : undefined,
        dto.startsAt,
        dto.endsAt,
      );
    if (a.status !== 'ACTIVE')
      throw new ConflictException('Amenity is inactive');
    if (
      !allowStarted &&
      !skipNotice &&
      start < Date.now() + a.advanceDays * 86400000
    )
      throw new BadRequestException(
        `Reserve at least ${a.advanceDays} days before the start time`,
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
    const s = localParts(start, a.timeZone),
      e = localParts(end, a.timeZone);
    if (
      s.date !== e.date ||
      !a.weekdays.includes(s.weekday) ||
      s.minute < minutes(a.opensAt) ||
      e.minute > minutes(a.closesAt)
    )
      throw new BadRequestException(
        'Reservation is outside same-day operating hours; overnight bookings are unsupported',
      );
    if (
      (s.minute - minutes(a.opensAt)) % a.bookingIntervalMinutes ||
      (e.minute - minutes(a.opensAt)) % a.bookingIntervalMinutes
    )
      throw new BadRequestException(
        'Start and end must follow the configured booking interval from opening time',
      );
    if (
      this.blocks
        .findAll()
        .some(
          (b) =>
            b.amenityId === a.id &&
            !b.releasedAt &&
            this.bufferedOverlap(b, dto, a.turnaroundMinutes),
        )
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
    const intervals = reservations.flatMap((b) =>
      this.heldIntervals(b, a.turnaroundMinutes),
    );
    const conflicting = intervals.filter((b) => b.start < end && start < b.end);
    if (a.exclusive && conflicting.length)
      throw new ConflictException(
        'This time is reserved or within the turnaround buffer',
      );
    const events = conflicting
      .flatMap((b) => [
        { at: Math.max(start, b.start), delta: b.attendees },
        { at: Math.min(end, b.end), delta: -b.attendees },
      ])
      .sort((x, y) => x.at - y.at || x.delta - y.delta);
    let occupied = dto.attendees;
    for (const event of events) {
      occupied += event.delta;
      if (occupied > a.capacity)
        throw new ConflictException(
          'Insufficient capacity for this time, including pending holds and turnaround buffers',
        );
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
    const fingerprint = JSON.stringify([
      new Date(instant(dto.startsAt)).toISOString(),
      new Date(instant(dto.endsAt)).toISOString(),
      dto.attendees,
      dto.expectedFeeMinor,
      dto.expectedDepositMinor,
    ]);
    const retryKey = dto.clientRequestId
      ? `${actor.id}:${id}:${dto.clientRequestId}`
      : undefined;
    const prior = retryKey && this.creationRetries.get(retryKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConflictException(
          'Request ID was already used for a different booking',
        );
      return this.bookings.findById(prior.id)!;
    }
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
    const booking = this.bookings.create({
      originalDurationMinutes:
        (instant(dto.endsAt) - instant(dto.startsAt)) / 60000,
      extensionCharges: [],
      version: 1,
      changes: [],
      clientRequestId: dto.clientRequestId,
      amenityId: id,
      amenityName: a.name,
      communityId: a.communityId,
      residentId: actor.id,
      apartmentId: (this.communities.resolveResidentOccupancy
        ? this.communities.resolveResidentOccupancy(
            actor.id,
            undefined,
            dto.startsAt,
            dto.endsAt,
          )
        : this.communities.resolveResidentHierarchy(actor.id)
      ).apartment.id,
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
    if (retryKey)
      this.creationRetries.set(retryKey, { fingerprint, id: booking.id });
    return booking;
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
      .map((b) => this.expireChanges(b))
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
    const amenity = this.amenity(actor, b.amenityId);
    if (
      status === 'CANCELLED' &&
      Date.parse(b.startsAt) - Date.now() <=
        amenity.cancellationCutoffMinutes * 60000
    )
      throw new ConflictException('The cancellation deadline has passed');
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
        false,
        true, // Notice was enforced when the resident submitted this held booking.
      );
    const at = now();
    const paymentStatus =
      status !== 'APPROVED' && b.paymentStatus === 'PENDING'
        ? 'VOIDED'
        : b.paymentStatus;
    return this.bookings.update(id, {
      status,
      extensionCharges:
        status === 'APPROVED'
          ? b.extensionCharges
          : b.extensionCharges.map((charge) => ({
              ...charge,
              paymentStatus:
                charge.paymentStatus === 'PENDING'
                  ? ('VOIDED' as const)
                  : charge.paymentStatus,
            })),
      version: b.version + 1,
      changes:
        status === 'APPROVED'
          ? b.changes
          : b.changes.map((change) =>
              change.status === 'PENDING_APPROVAL'
                ? {
                    ...change,
                    status: 'REJECTED' as const,
                    decidedAt: at,
                    reason: 'Booking cancelled or rejected',
                  }
                : change,
            ),
      paymentStatus,
      history: [
        ...b.history,
        { at, actorId: actor.id, status, reason: reason.trim() },
      ],
      paymentHistory: [
        ...(paymentStatus !== b.paymentStatus
          ? [
              ...b.paymentHistory,
              {
                at,
                status: paymentStatus,
                reason: 'Unpaid charge voided; no refund transaction',
              },
            ]
          : b.paymentHistory),
        ...(status === 'APPROVED'
          ? []
          : b.extensionCharges
              .filter((charge) => charge.paymentStatus === 'PENDING')
              .map((charge) => ({
                at,
                chargeId: charge.id,
                status: 'VOIDED' as const,
                reason:
                  'Unpaid extension charge voided with booking; no refund transaction',
              }))),
      ],
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
  private bufferedOverlap(
    a: { startsAt: string; endsAt: string },
    b: { startsAt: string; endsAt: string },
    buffer: number,
  ) {
    return (
      Date.parse(a.startsAt) - buffer * 60000 < Date.parse(b.endsAt) &&
      Date.parse(b.startsAt) < Date.parse(a.endsAt) + buffer * 60000
    );
  }
  private heldIntervals(b: AmenityBooking, buffer: number) {
    this.expireChanges(b);
    const intervals = [
      b,
      ...b.changes.filter((c) => c.status === 'PENDING_APPROVAL'),
    ]
      .map((c) => ({
        start: Date.parse(c.startsAt) - buffer * 60000,
        end: Date.parse(c.endsAt) + buffer * 60000,
        attendees: b.attendees,
      }))
      .sort((x, y) => x.start - y.start);
    const merged: typeof intervals = [];
    for (const interval of intervals) {
      const previous = merged.at(-1);
      if (previous && interval.start <= previous.end)
        previous.end = Math.max(previous.end, interval.end);
      else merged.push({ ...interval });
    }
    return merged;
  }
  private booking(actor: AuthenticatedUser, id: string, admin = false) {
    const communityId = this.scope(actor, admin);
    const b = this.bookings.findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    if (
      b.communityId !== communityId ||
      (actor.role === RoleName.Resident && b.residentId !== actor.id)
    )
      throw new ForbiddenException('Booking access denied');
    return this.expireChanges(b);
  }
  private expireChanges(b: AmenityBooking) {
    const a = this.amenities.findById(b.amenityId)!;
    const expired = (c: AmenityBooking['changes'][number]) =>
      c.status === 'PENDING_APPROVAL' &&
      (c.kind === 'EXTEND'
        ? Date.parse(b.endsAt)
        : Date.parse(b.startsAt) - a.cancellationCutoffMinutes * 60000) <=
        Date.now();
    if (b.changes.some(expired)) {
      const at = now();
      this.bookings.update(b.id, {
        version: b.version + 1,
        changes: b.changes.map((c) =>
          expired(c)
            ? {
                ...c,
                status: 'EXPIRED',
                decidedAt: at,
                reason:
                  'Approval deadline passed; original reservation unchanged',
              }
            : c,
        ),
        history: [
          ...b.history,
          {
            at,
            actorId: 'system',
            status: b.status,
            reason: 'Pending change expired; its additional hold was released',
          },
        ],
      });
    }
    return b;
  }
  private eligibleChange(
    b: AmenityBooking,
    a: Amenity,
    kind: 'EDIT' | 'EXTEND',
  ) {
    if (!active(b) || b.changes.some((c) => c.status === 'PENDING_APPROVAL'))
      throw new ConflictException(
        'This booking is inactive or already has a pending change',
      );
    if (kind === 'EXTEND') {
      if (
        !a.allowExtensions ||
        b.status !== 'APPROVED' ||
        Date.parse(b.endsAt) <= Date.now()
      )
        throw new ConflictException(
          'Extensions require an unexpired approved booking and amenity permission',
        );
    } else if (
      Date.parse(b.startsAt) - Date.now() <=
      a.cancellationCutoffMinutes * 60000
    )
      throw new ConflictException('The booking change deadline has passed');
  }
  private validateChange(
    a: Amenity,
    b: AmenityBooking,
    dto: BookingWindowDto & { kind: 'EDIT' | 'EXTEND' },
    skipNotice = false,
  ) {
    if (dto.attendees !== b.attendees)
      throw new BadRequestException(
        'Attendee count cannot change; cancel and rebook to change capacity',
      );
    if (
      dto.kind === 'EDIT' &&
      instant(dto.endsAt) - instant(dto.startsAt) >
        Date.parse(b.endsAt) - Date.parse(b.startsAt)
    )
      throw new BadRequestException(
        'Use an extension request to increase the reserved duration; time edits cannot add uncharged time',
      );
    if (
      dto.kind === 'EXTEND' &&
      (instant(dto.startsAt) !== Date.parse(b.startsAt) ||
        instant(dto.endsAt) <= Date.parse(b.endsAt))
    )
      throw new BadRequestException(
        'An extension must preserve the start and increase the end time',
      );
    return this.validateAvailability(
      a,
      dto,
      b.residentId,
      b.id,
      dto.kind === 'EXTEND',
      skipNotice,
    );
  }
  dayAvailability(
    actor: AuthenticatedUser,
    id: string,
    dto: DayAvailabilityDto,
  ) {
    return this.dayOptions(actor, this.amenity(actor, id), dto);
  }
  changeAvailability(
    actor: AuthenticatedUser,
    id: string,
    dto: ChangeAvailabilityDto,
  ) {
    const b = this.booking(actor, id);
    const a = this.amenity(actor, b.amenityId);
    this.eligibleChange(b, a, dto.kind);
    if (dto.attendees !== b.attendees)
      throw new BadRequestException('Keep the original attendee count');
    return this.dayOptions(actor, a, dto, b, dto.kind);
  }
  private dayOptions(
    actor: AuthenticatedUser,
    a: Amenity,
    dto: DayAvailabilityDto,
    booking?: AmenityBooking,
    kind?: 'EDIT' | 'EXTEND',
  ) {
    if (!validDate(dto.date))
      throw new BadRequestException('Use a valid calendar date');
    if (
      !Number.isInteger(dto.attendees) ||
      dto.attendees < 1 ||
      dto.attendees > a.capacity
    )
      throw new BadRequestException('Attendees exceed amenity capacity');
    const serverNow = Date.now();
    const earliestStart = serverNow + a.advanceDays * 86400000;
    const bookingWindow = {
      minDate: localParts(earliestStart, a.timeZone).date,
      earliestStartsAt: new Date(earliestStart).toISOString(),
    };
    let unavailableReason: { code: string; message: string } | null = null;
    if (a.status !== 'ACTIVE')
      unavailableReason = {
        code: 'INACTIVE',
        message: 'This amenity is currently inactive.',
      };
    else if (kind !== 'EXTEND' && dto.date < bookingWindow.minDate)
      unavailableReason = {
        code: 'MINIMUM_NOTICE',
        message: `Reserve at least ${a.advanceDays} days before the start time. The earliest booking date is ${bookingWindow.minDate} (${a.timeZone}).`,
      };
    else if (
      !a.weekdays.includes(new Date(`${dto.date}T00:00:00Z`).getUTCDay())
    )
      unavailableReason = {
        code: 'CLOSED_DAY',
        message:
          'This amenity is closed on the selected day. Choose one of its open days.',
      };
    else if (
      actor.role === RoleName.Resident &&
      this.bookings
        .findAll()
        .filter(
          (b) =>
            b.amenityId === a.id &&
            b.residentId === actor.id &&
            b.id !== booking?.id &&
            active(b) &&
            Date.parse(b.endsAt) > serverNow,
        ).length >= a.maxActiveBookings
    )
      unavailableReason = {
        code: 'BOOKING_LIMIT',
        message: `You already have the maximum of ${a.maxActiveBookings} active bookings for this amenity. Review your bookings before reserving again.`,
      };
    const candidates = unavailableReason
      ? []
      : dayInstants(
          dto.date,
          a.timeZone,
          a.opensAt,
          a.closesAt,
          a.bookingIntervalMinutes,
        );
    const valid = (start: number, end: number) => {
      const window = {
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        attendees: dto.attendees,
      };
      try {
        if (booking && kind)
          this.validateChange(a, booking, { ...window, kind });
        else
          this.validateAvailability(
            a,
            window,
            actor.role === RoleName.Resident ? actor.id : undefined,
          );
        return true;
      } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof ConflictException
        )
          return false;
        throw error;
      }
    };
    const choice = (t: number) => ({
      value: new Date(t).toISOString(),
      label: localParts(t, a.timeZone).label,
    });
    const starts =
      kind === 'EXTEND' && booking
        ? [Date.parse(booking.startsAt)]
        : candidates.filter((start) => {
            const end = candidates.find(
              (t) => t >= start + a.minDurationMinutes * 60000,
            );
            return end !== undefined && valid(start, end);
          });
    const selected =
      kind === 'EXTEND' && booking
        ? Date.parse(booking.startsAt)
        : dto.startsAt
          ? instant(dto.startsAt)
          : undefined;
    const ends =
      selected !== undefined && starts.includes(selected)
        ? candidates
            .filter(
              (end) =>
                end > selected &&
                end - selected <= a.maxDurationMinutes * 60000 &&
                valid(selected, end),
            )
            .map((t) => ({
              ...choice(t),
              durationMinutes: (t - selected) / 60000,
              additionalFeeMinor:
                booking && kind === 'EXTEND'
                  ? extensionFeeMinor(
                      booking.feeMinor,
                      booking.originalDurationMinutes,
                      (t - Date.parse(booking.endsAt)) / 60000,
                    )
                  : 0,
            }))
        : [];
    // Return anonymous occupied windows only for this amenity/date. No resident IDs,
    // apartment IDs, approval notes, or other booking details are exposed.
    const occupied = this.bookings
      .findAll()
      .filter((b) => b.amenityId === a.id && b.id !== booking?.id && active(b))
      .flatMap((b) =>
        this.heldIntervals(b, a.turnaroundMinutes).map((held) => ({
          startsAt: new Date(held.start).toISOString(),
          endsAt: new Date(held.end).toISOString(),
          reason: a.exclusive
            ? 'Reserved / turnaround buffer'
            : 'Shared capacity in use',
        })),
      );
    const maintenance = this.blocks
      .findAll()
      .filter((b) => b.amenityId === a.id && !b.releasedAt)
      .map((b) => ({
        startsAt: new Date(
          Date.parse(b.startsAt) - a.turnaroundMinutes * 60000,
        ).toISOString(),
        endsAt: new Date(
          Date.parse(b.endsAt) + a.turnaroundMinutes * 60000,
        ).toISOString(),
        reason: 'Maintenance closure',
      }));
    const midnight = Date.parse(`${dto.date}T00:00:00Z`);
    if (
      !unavailableReason &&
      (!starts.length || (selected !== undefined && !ends.length))
    ) {
      if (
        kind !== 'EXTEND' &&
        candidates.length &&
        !candidates.some(
          (start) =>
            start >= earliestStart &&
            start > serverNow &&
            candidates.some(
              (end) => end >= start + a.minDurationMinutes * 60000,
            ),
        )
      )
        unavailableReason = {
          code: 'MINIMUM_NOTICE',
          message: `No start time on this date meets the ${a.advanceDays}-day notice and minimum duration. Choose a later open date. Earliest start: ${bookingWindow.minDate} at ${localParts(earliestStart, a.timeZone).label}.`,
        };
      else
        unavailableReason = {
          code: 'NO_AVAILABILITY',
          message:
            kind === 'EXTEND'
              ? 'No valid extension fits the duration limits, opening hours, or existing reservations.'
              : 'No bookable interval is available for this group on the selected date. Check the reserved or restricted intervals below, or choose another open date.',
        };
    }
    return {
      bookingWindow,
      attendees: dto.attendees,
      selectedStartsAt:
        selected === undefined ? null : new Date(selected).toISOString(),
      unavailableReason,
      date: dto.date,
      timeZone: a.timeZone,
      opensAt: a.opensAt,
      closesAt: a.closesAt,
      starts: starts.map(choice),
      ends,
      unavailable: [...occupied, ...maintenance]
        .filter(
          (w) =>
            Date.parse(w.startsAt) < midnight + 38 * 3600000 &&
            Date.parse(w.endsAt) > midnight - 14 * 3600000,
        )
        .filter(
          (w) =>
            localParts(Date.parse(w.startsAt), a.timeZone).date <= dto.date &&
            localParts(Date.parse(w.endsAt) - 1, a.timeZone).date >= dto.date,
        ),
      feeMinor: booking?.feeMinor ?? a.feeMinor,
      depositMinor: booking?.depositMinor ?? a.depositMinor,
      approvedExtensionFeeMinor:
        booking?.extensionCharges
          .filter((charge) => charge.paymentStatus !== 'VOIDED')
          .reduce((total, charge) => total + charge.amountMinor, 0) ?? 0,
      currency: 'INR',
      requiresApproval: a.requiresApproval,
      version: booking?.version,
      notice:
        'Extension fees use the original fee and duration, rounded half up to paise. Deposits are not charged again. Approval does not collect payment.',
    };
  }
  change(actor: AuthenticatedUser, id: string, dto: ChangeBookingDto) {
    if (actor.role !== RoleName.Resident)
      throw new ForbiddenException(
        'Only the owning resident may request a change',
      );
    const b = this.booking(actor, id);
    const a = this.amenity(actor, b.amenityId);
    const start = new Date(instant(dto.startsAt)).toISOString(),
      end = new Date(instant(dto.endsAt)).toISOString();
    const existing = b.changes.find(
      (c) => c.clientRequestId === dto.clientRequestId,
    );
    if (existing) {
      if (
        existing.kind !== dto.kind ||
        existing.startsAt !== start ||
        existing.endsAt !== end ||
        existing.attendees !== dto.attendees
      )
        throw new ConflictException(
          'Request ID was already used for another change',
        );
      return b;
    }
    if (dto.expectedVersion !== b.version)
      throw new ConflictException(
        'Booking changed. Refresh before trying again',
      );
    this.eligibleChange(b, a, dto.kind);
    this.validateChange(a, b, dto);
    if (start === b.startsAt && end === b.endsAt)
      throw new BadRequestException('Select a different interval');
    const at = now(),
      status = a.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';
    const change = {
      extensionDurationMinutes:
        dto.kind === 'EXTEND'
          ? (instant(end) - Date.parse(b.endsAt)) / 60000
          : 0,
      extensionFeeMinor:
        dto.kind === 'EXTEND'
          ? extensionFeeMinor(
              b.feeMinor,
              b.originalDurationMinutes,
              (instant(end) - Date.parse(b.endsAt)) / 60000,
            )
          : 0,
      id: randomUUID(),
      clientRequestId: dto.clientRequestId,
      kind: dto.kind,
      status,
      startsAt: start,
      endsAt: end,
      attendees: dto.attendees,
      createdAt: at,
    } as const;
    return this.bookings.update(id, {
      ...(status === 'APPROVED'
        ? this.approvedExtensionCharge(b, change, at)
        : {}),
      ...(status === 'APPROVED' ? { startsAt: start, endsAt: end } : {}),
      version: b.version + 1,
      changes: [...b.changes, change],
      history: [
        ...b.history,
        {
          at,
          actorId: actor.id,
          status: b.status,
          reason: `${dto.kind} ${status}; extension quote ${change.extensionFeeMinor} paise; deposit unchanged`,
        },
      ],
    });
  }
  decideChange(
    actor: AuthenticatedUser,
    id: string,
    changeId: string,
    approve: boolean,
    reason: string,
  ) {
    const b = this.booking(actor, id, true);
    const c = b.changes.find((change) => change.id === changeId);
    if (!c) throw new NotFoundException('Booking change not found');
    if (!reason.trim()) throw new BadRequestException('A reason is required');
    const status = approve ? 'APPROVED' : 'REJECTED';
    if (c.status === status) return b;
    if (c.status !== 'PENDING_APPROVAL' || !active(b))
      throw new ConflictException('Change is no longer pending');
    if (approve) {
      const a = this.amenity(actor, b.amenityId, true);
      if (
        (c.kind === 'EXTEND' &&
          (!a.allowExtensions ||
            b.status !== 'APPROVED' ||
            Date.parse(b.endsAt) <= Date.now())) ||
        (c.kind === 'EDIT' &&
          Date.parse(b.startsAt) - Date.now() <=
            a.cancellationCutoffMinutes * 60000)
      )
        throw new ConflictException(
          'Booking is no longer eligible for this change',
        );
      this.validateChange(a, b, c, true);
    }
    const at = now();
    return this.bookings.update(id, {
      ...(approve ? this.approvedExtensionCharge(b, c, at) : {}),
      ...(approve ? { startsAt: c.startsAt, endsAt: c.endsAt } : {}),
      version: b.version + 1,
      changes: b.changes.map((change) =>
        change.id === c.id
          ? { ...change, status, reason: reason.trim(), decidedAt: at }
          : change,
      ),
      history: [
        ...b.history,
        {
          at,
          actorId: actor.id,
          status: b.status,
          reason: `${c.kind} ${status}: ${reason.trim()}`,
        },
      ],
    });
  }
  private approvedExtensionCharge(
    b: AmenityBooking,
    change: BookingChange,
    at: string,
  ): Partial<AmenityBooking> {
    if (
      change.kind !== 'EXTEND' ||
      b.extensionCharges.some((charge) => charge.changeId === change.id)
    )
      return {};
    const paymentStatus =
      change.extensionFeeMinor > 0 ? 'PENDING' : 'NOT_REQUIRED';
    return {
      extensionCharges: [
        ...b.extensionCharges,
        {
          id: change.id,
          changeId: change.id,
          amountMinor: change.extensionFeeMinor,
          currency: 'INR',
          paymentStatus,
          createdAt: at,
        },
      ],
      paymentStatus: change.extensionFeeMinor > 0 ? 'PENDING' : b.paymentStatus,
      paymentHistory: [
        ...b.paymentHistory,
        {
          at,
          chargeId: change.id,
          status: paymentStatus,
          reason: 'Extension approved; no payment collected; deposit unchanged',
        },
      ],
    };
  }
  block(actor: AuthenticatedUser, id: string, dto: MaintenanceBlockDto) {
    const a = this.amenity(actor, id, true);
    this.window(dto.startsAt, dto.endsAt);
    if (!dto.reason.trim())
      throw new BadRequestException('A maintenance reason is required');
    if (
      this.bookings
        .findAll()
        .some(
          (b) =>
            b.amenityId === id &&
            active(b) &&
            this.heldIntervals(b, a.turnaroundMinutes).some(
              (held) =>
                held.start < Date.parse(dto.endsAt) &&
                Date.parse(dto.startsAt) < held.end,
            ),
        )
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
