import { Optional } from '@nestjs/common';
import { UserAccessService } from '../users/user-access.service';
import { OnboardTenantDto } from './rentals.dto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import { CommunityService } from '../community/community.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import {
  CreateLeaseDto,
  CreateListingDto,
  DepositAdjustmentDto,
  DepositEvidenceDto,
  DepositDeductionDecisionDto,
  DepositDisputeResolutionDto,
  PaymentEvidenceDto,
  RentAmendmentDto,
  RentEscalationDto,
  RenewalTermsDto,
  UpdateListingDto,
} from './rentals.dto';

type RentalEvent = {
  action: string;
  actorId: string;
  at: string;
  reason: string;
};
type Listing = {
  availableUntil?: string;
  history: RentalEvent[];
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  payeeId: string;
  id: string;
  apartmentId: string;
  communityId: string;
  arrangement: 'OWNER' | 'COMMUNITY';
  landlordId: string;
  monthlyRent: number;
  securityDeposit: number;
  availableFrom: string;
  details?: string;
  status: string;
  createdAt: string;
};
type Lease = {
  history: RentalEvent[];
  payeeId: string;
  adminApprovedBy?: string;
  adminApprovedAt?: string;
  activatedBy?: string;
  activatedAt?: string;
  terminatedAt?: string;
  id: string;
  listingId: string;
  apartmentId: string;
  communityId: string;
  arrangement: 'OWNER' | 'COMMUNITY';
  landlordId: string;
  tenantId: string;
  monthlyRent: number;
  securityDeposit: number;
  depositCollected: number;
  startDate: string;
  endDate: string;
  dueDay: number;
  escalation?: RentEscalationDto;
  predecessorLeaseId?: string;
  tenantAccepted: boolean;
  status: string;
  createdAt: string;
};
type Obligation = {
  payeeId: string;
  id: string;
  leaseId: string;
  billingPeriod: string;
  amountDue: number;
  dueDate: string;
  amountPaid: number;
  status: string;
};
type Payment = {
  id: string;
  leaseId: string;
  obligationId: string;
  payerId: string;
  payeeId: string;
  amount: number;
  transactionReference: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
};
type PaymentRefund = {
  id: string;
  paymentId: string;
  leaseId: string;
  obligationId: string;
  amount: number;
  reason: string;
  transactionReference: string;
  recordedBy: string;
  status: 'PENDING_TENANT_CONFIRMATION' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
};
type DepositEntry = {
  id: string;
  leaseId: string;
  type: 'COLLECTION' | 'DEDUCTION' | 'REFUND';
  amount: number;
  reason?: string;
  transactionReference?: string;
  recordedBy: string;
  status:
    | 'PENDING_VERIFICATION'
    | 'PENDING_TENANT_CONFIRMATION'
    | 'DISPUTED'
    | 'VERIFIED'
    | 'REJECTED';
  disputeReason?: string;
  decisionBy?: string;
  decisionAt?: string;
  resolutionReason?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
};
type LifecycleRequest = {
  id: string;
  leaseId: string;
  type: 'RENEWAL' | 'TERMINATION';
  requestedBy: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'WITHDRAWN';
  renewalTerms?: RenewalTermsDto;
  successorLeaseId?: string;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
};
type AmendmentTerms = {
  monthlyRent?: number;
  securityDeposit?: number;
  dueDay?: number;
  escalation?: RentEscalationDto | null;
};
type Amendment = {
  id: string;
  leaseId: string;
  proposedBy: string;
  proposedAt: string;
  effectiveDate: string;
  reason: string;
  terms: AmendmentTerms;
  status:
    | 'PENDING_TENANT_ACCEPTANCE'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'WITHDRAWN'
    | 'APPLIED';
  decidedBy?: string;
  decidedAt?: string;
  appliedAt?: string;
};
const now = () => new Date().toISOString();
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;
const MAX_RENTAL_AMOUNT = 100000000;

@Injectable()
export class RentalsService {
  private listings: Listing[] = [];
  private leases: Lease[] = [];
  private obligations: Obligation[] = [];
  private payments: Payment[] = [];
  private paymentRefunds: PaymentRefund[] = [];
  private depositEntries: DepositEntry[] = [];
  private requests: LifecycleRequest[] = [];
  private amendments: Amendment[] = [];
  private onboardingRetries = new Map<
    string,
    { fingerprint: string; leaseId: string }
  >();
  constructor(
    private readonly community: CommunityService,
    @Inject(serviceToken('users'))
    private readonly users: CrudService<User, any, any>,
    @Optional() private readonly accounts?: UserAccessService,
  ) {
    this.community.registerRentalPolicy?.({
      serviceAccess: (userId, apartmentId) => {
        if (
          this.leases.some(
            (lease) =>
              lease.apartmentId === apartmentId &&
              lease.status === 'ACTIVE' &&
              lease.tenantId !== userId &&
              lease.startDate > new Date().toISOString().slice(0, 10),
          )
        )
          throw new ConflictException(
            'New unscheduled paid services are blocked for an apartment with an activated future tenancy; complete services before activating the handover',
          );
      },
      resolve: (userId, apartmentId, start, end) =>
        this.resolveOccupancy(userId, apartmentId, start, end),
      apartmentChange: (id) => this.assertApartmentMutable(id),
      userChange: (id, target) => this.assertUserMutable(id, target),
      ownerAssignment: (id, userId) => this.assertOwnerAssignment(id, userId),
    });
  }

  availableListings(actor: AuthenticatedUser) {
    this.refreshRentals();
    const communityId =
      actor.role === RoleName.CommunityAdmin
        ? this.users.findById(actor.id).communityId
        : actor.role === RoleName.Resident
          ? this.communityForUser(this.users.findById(actor.id))
          : undefined;
    return this.listings
      .filter(
        (x) =>
          x.status === 'AVAILABLE' &&
          x.communityId === communityId &&
          x.payeeId &&
          x.arrangement === 'COMMUNITY',
      )
      .map((x) => this.presentListing(x));
  }
  managed(actor: AuthenticatedUser) {
    this.refreshRentals();
    return this.listings
      .filter((x) => this.canManage(actor, x))
      .map((x) => this.presentListing(x));
  }
  ownedApartments(actor: AuthenticatedUser) {
    this.requireResident(actor);
    return this.community
      .listApartments()
      .filter((apartment) => apartment.ownerUserId === actor.id);
  }
  tenantsForListing(
    actor: AuthenticatedUser,
    listingId: string,
    email?: string,
  ) {
    const listing = this.listing(listingId);
    this.assertManager(actor, listing);
    return this.users
      .findAll()
      .filter(
        (user) =>
          user.id !== listing.landlordId &&
          user.role === RoleName.Resident &&
          this.communityForUser(user) === listing.communityId &&
          (actor.role === RoleName.CommunityAdmin ||
            (email && user.email.toLowerCase() === email.trim().toLowerCase())),
      )
      .map((user) => ({ id: user.id, name: user.name }));
  }
  managedLeases(actor: AuthenticatedUser) {
    this.refreshRentals();
    return this.leases
      .filter((lease) => this.canManageLease(actor, lease))
      .map((lease) => {
        this.refreshLease(lease);
        this.generateCurrentObligations(lease);
        return {
          ...lease,
          readOnly: lease.arrangement !== 'COMMUNITY',
          requiresReview:
            !lease.payeeId ||
            (lease.status === 'ACTIVE' && !lease.adminApprovedBy),
          tenant: (() => {
            const user = this.users.findById(lease.tenantId);
            return { id: user.id, name: user.name };
          })(),
          obligations: this.obligations
            .filter((o) => o.leaseId === lease.id)
            .map((o) => ({ ...o, outstandingBalance: this.outstanding(o) })),
          payments: this.payments
            .filter((p) => p.leaseId === lease.id)
            .map((p) => ({ ...p })),
          refunds: this.paymentRefunds
            .filter((p) => p.leaseId === lease.id)
            .map((p) => ({ ...p })),
          requests: this.requests
            .filter((r) => r.leaseId === lease.id)
            .map((r) => ({ ...r })),
          amendments: this.amendments
            .filter((a) => a.leaseId === lease.id)
            .map((a) => ({ ...a, terms: { ...a.terms } })),
          deposit: this.depositSummary(lease),
          reminders: this.reminders(lease),
          currentMonthlyRent: this.rentForPeriod(
            lease,
            new Date().toISOString().slice(0, 7),
          ),
          nextRentIncrease: this.nextRentIncrease(lease),
        };
      });
  }
  myRentals(actor: AuthenticatedUser) {
    this.requireResident(actor);
    const leases = this.leases
      .filter((l) => l.tenantId === actor.id)
      .map((l) => {
        this.refreshLease(l);
        this.generateCurrentObligations(l);
        return {
          ...l,
          readOnly: l.arrangement !== 'COMMUNITY',
          requiresReview:
            !l.payeeId || (l.status === 'ACTIVE' && !l.adminApprovedBy),
          currentMonthlyRent: this.rentForPeriod(
            l,
            new Date().toISOString().slice(0, 7),
          ),
          nextRentIncrease: this.nextRentIncrease(l),
          obligations: this.obligations
            .filter((o) => o.leaseId === l.id)
            .map((o) => ({ ...o, outstandingBalance: this.outstanding(o) })),
          payments: this.payments
            .filter((p) => p.leaseId === l.id)
            .map((p) => ({ ...p })),
          refunds: this.paymentRefunds
            .filter((p) => p.leaseId === l.id)
            .map((p) => ({ ...p })),
          requests: this.requests.filter((r) => r.leaseId === l.id),
          amendments: this.amendments
            .filter((a) => a.leaseId === l.id)
            .map((a) => ({ ...a, terms: { ...a.terms } })),
          deposit: this.depositSummary(l),
          reminders: this.reminders(l),
        };
      });
    return { listings: this.availableListings(actor), leases };
  }
  createListing(actor: AuthenticatedUser, dto: CreateListingDto) {
    if (dto.arrangement !== 'COMMUNITY')
      throw new GoneException(
        'Private rentals are managed outside Urbanity; new private rental records are disabled',
      );
    this.refreshRentals();
    const apartment = this.community.getApartment(dto.apartmentId);
    const hierarchy = this.community.getFloor(apartment.floorId);
    const tower = this.community.getTower(hierarchy.towerId);
    this.assertCommunityAdmin(actor, tower.communityId);
    if (apartment.ownerUserId)
      throw new BadRequestException(
        'Resident-owned apartments cannot be listed as community rentals',
      );
    this.assertNoUnverifiedOccupants(apartment.id);
    if (
      this.listings.some(
        (l) =>
          l.apartmentId === apartment.id &&
          [
            'DRAFT',
            'AVAILABLE',
            'RESERVED',
            'RENTED',
            'PENDING_ADMIN_APPROVAL',
          ].includes(l.status),
      )
    )
      throw new ConflictException(
        'Apartment already has an open rental listing',
      );
    this.validMoney(dto.monthlyRent, 'Monthly rent');
    this.validMoney(dto.securityDeposit, 'Security deposit');
    this.validDate(dto.availableFrom);
    if (dto.availableUntil) {
      this.validDate(dto.availableUntil);
      if (dto.availableUntil <= dto.availableFrom)
        throw new BadRequestException('Availability end must follow its start');
    }
    if (
      this.leases.some(
        (l) =>
          l.apartmentId === apartment.id &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status) &&
          this.dateOnly(l.endDate) >= new Date().toISOString().slice(0, 10),
      )
    )
      throw new ConflictException('Apartment has a conflicting lease');
    const listing: Listing = {
      payeeId: actor.id,
      history: [
        {
          action: 'SUBMITTED',
          actorId: actor.id,
          at: now(),
          reason: 'Rental listing submitted',
        },
      ],
      id: randomUUID(),
      apartmentId: apartment.id,
      communityId: tower.communityId,
      arrangement: dto.arrangement,
      landlordId: tower.communityId,
      availableUntil: dto.availableUntil,
      monthlyRent: dto.monthlyRent,
      securityDeposit: dto.securityDeposit,
      availableFrom: dto.availableFrom,
      details: dto.details?.trim(),
      status: 'DRAFT',
      createdAt: now(),
    };
    this.listings.push(listing);
    return { ...listing };
  }
  updateListing(actor: AuthenticatedUser, id: string, dto: UpdateListingDto) {
    dto = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    if (Object.values(dto).some((value) => value === null))
      throw new BadRequestException('Listing fields cannot be null');
    const item = this.listing(id);
    this.assertManager(actor, item);
    if (
      dto.status !== undefined &&
      !['DRAFT', 'AVAILABLE', 'WITHDRAWN'].includes(dto.status)
    )
      throw new BadRequestException('Invalid listing transition');
    if (dto.monthlyRent !== undefined)
      this.validMoney(dto.monthlyRent, 'Monthly rent');
    if (dto.securityDeposit !== undefined)
      this.validMoney(dto.securityDeposit, 'Security deposit');
    if (dto.availableFrom) this.validDate(dto.availableFrom);
    if (dto.availableUntil) this.validDate(dto.availableUntil);
    if (
      (dto.availableUntil ?? item.availableUntil) &&
      (dto.availableUntil ?? item.availableUntil)! <=
        (dto.availableFrom ?? item.availableFrom)
    )
      throw new BadRequestException('Availability end must follow start');
    if (
      ['RESERVED', 'RENTED'].includes(item.status) &&
      Object.keys(dto).length > 0
    )
      throw new BadRequestException(
        'A reserved or leased listing terms cannot be changed',
      );
    if (
      dto.status === 'AVAILABLE' &&
      this.listings.some(
        (other) =>
          other.id !== item.id &&
          other.apartmentId === item.apartmentId &&
          ['AVAILABLE', 'RESERVED', 'RENTED'].includes(other.status),
      )
    )
      throw new BadRequestException(
        'This apartment already has an available or leased rental listing',
      );
    if (['REJECTED', 'WITHDRAWN'].includes(item.status))
      throw new BadRequestException(
        'Rejected or withdrawn listings cannot be republished; submit a new request',
      );
    if (item.arrangement === 'COMMUNITY' && dto.status === 'AVAILABLE') {
      if (this.community.getApartment(item.apartmentId).ownerUserId)
        throw new ConflictException('Apartment is now privately owned');
      this.assertNoUnverifiedOccupants(item.apartmentId);
    }
    Object.assign(item, dto);
    (item.history ??= []).push({
      action: item.status,
      actorId: actor.id,
      at: now(),
      reason: 'Listing updated',
    });
    return { ...item };
  }
  createLease(actor: AuthenticatedUser, dto: CreateLeaseDto) {
    const listing = this.listing(dto.listingId);
    this.assertManager(actor, listing);
    if (listing.status !== 'AVAILABLE')
      throw new BadRequestException('Listing is not available');
    const tenant = this.users.findById(dto.tenantId);
    if (tenant.id === listing.landlordId)
      throw new BadRequestException('An owner cannot be their own tenant');
    if (
      tenant.role !== RoleName.Resident ||
      this.communityForUser(tenant) !== listing.communityId
    )
      throw new BadRequestException(
        'Tenant must be a resident in the listing community',
      );
    this.validDate(dto.startDate);
    this.validDate(dto.endDate);
    this.validMoney(listing.monthlyRent, 'Monthly rent');
    this.validMoney(listing.securityDeposit, 'Security deposit');
    if (dto.escalation)
      this.validateEscalation(dto.escalation, dto.startDate, dto.endDate);
    if (!Number.isInteger(dto.dueDay) || dto.dueDay < 1 || dto.dueDay > 31)
      throw new BadRequestException('Rent due day must be between 1 and 31');
    if (this.dateOnly(dto.endDate) <= this.dateOnly(dto.startDate))
      throw new BadRequestException(
        'Lease end date must follow the start date',
      );
    this.leases.forEach((existing) => this.refreshLease(existing));
    if (
      this.leases.some(
        (l) =>
          l.apartmentId === listing.apartmentId &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status) &&
          Date.parse(dto.startDate) <= Date.parse(l.endDate) &&
          Date.parse(dto.endDate) >= Date.parse(l.startDate),
      )
    )
      throw new BadRequestException(
        'Lease dates overlap an active or proposed lease for this apartment',
      );
    if (listing.availableUntil && dto.endDate > listing.availableUntil)
      throw new BadRequestException('Lease exceeds approved rental period');
    if (this.dateOnly(dto.startDate) < this.dateOnly(listing.availableFrom))
      throw new BadRequestException(
        'Lease starts before the listing is available',
      );
    if (
      this.leases.some(
        (l) =>
          l.tenantId === tenant.id &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status) &&
          dto.startDate <= l.endDate &&
          dto.endDate >= l.startDate,
      )
    )
      throw new ConflictException('Tenant already has a conflicting lease');
    const lease: Lease = {
      payeeId: listing.payeeId,
      history: [
        {
          action: 'PROPOSED',
          actorId: actor.id,
          at: now(),
          reason:
            'Lease proposed; tenant acceptance and admin approval required',
        },
      ],
      id: randomUUID(),
      listingId: listing.id,
      apartmentId: listing.apartmentId,
      communityId: listing.communityId,
      arrangement: listing.arrangement,
      landlordId: listing.landlordId,
      tenantId: tenant.id,
      monthlyRent: listing.monthlyRent,
      securityDeposit: listing.securityDeposit,
      depositCollected: 0,
      startDate: this.dateOnly(dto.startDate),
      endDate: this.dateOnly(dto.endDate),
      dueDay: dto.dueDay,
      escalation: dto.escalation ? { ...dto.escalation } : undefined,
      tenantAccepted: false,
      status: 'PENDING_APPROVAL',
      createdAt: now(),
    };
    this.leases.push(lease);
    listing.status = 'RESERVED';
    return { ...lease };
  }
  acceptLease(actor: AuthenticatedUser, leaseId: string) {
    this.requireResident(actor);
    const lease = this.leases.find(
      (l) => l.id === leaseId && l.tenantId === actor.id,
    );
    if (!lease) throw new NotFoundException('Lease was not found');
    this.assertSupportedRental(lease);
    if (lease.status !== 'PENDING_APPROVAL' || lease.tenantAccepted)
      throw new BadRequestException('Lease is not awaiting tenant acceptance');
    lease.tenantAccepted = true;
    (lease.history ??= []).push({
      action: 'TENANT_ACCEPTED',
      actorId: actor.id,
      at: now(),
      reason: 'Tenant accepted lease terms',
    });
    return { id: lease.id, tenantAccepted: true, status: lease.status };
  }
  activateLease(actor: AuthenticatedUser, leaseId: string) {
    const lease = this.leaseForManager(actor, leaseId);
    if (lease.status === 'ACTIVE') return { ...lease };
    if (lease.status !== 'PENDING_APPROVAL' || !lease.tenantAccepted)
      throw new BadRequestException(
        'Tenant acceptance is required before lease activation',
      );
    const adminActivating = actor.role === RoleName.CommunityAdmin;
    if (!lease.payeeId)
      throw new ConflictException(
        'Rent payee is missing; authorized reconciliation is required',
      );
    if (!lease.adminApprovedBy && !adminActivating)
      throw new ForbiddenException(
        'Community Admin approval is required before activation',
      );
    if (lease.endDate < new Date().toISOString().slice(0, 10))
      throw new BadRequestException(
        'An expired lease proposal cannot be activated',
      );
    const listing = this.listing(lease.listingId);
    if (listing.status !== 'RESERVED' && !lease.predecessorLeaseId)
      throw new ConflictException(
        'Listing is no longer reserved for this lease',
      );
    this.assertNoLeaseOverlap(
      lease.apartmentId,
      lease.startDate,
      lease.endDate,
      lease.id,
    );
    if (
      this.leases.some(
        (l) =>
          l.id !== lease.id &&
          l.tenantId === lease.tenantId &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status) &&
          lease.startDate <= l.endDate &&
          lease.endDate >= l.startDate,
      )
    )
      throw new ConflictException(
        'Tenant occupancy conflicts with another lease',
      );
    this.assertHandover(lease);
    if (adminActivating)
      this.reviewLease(actor, leaseId, 'APPROVED', 'Admin activation approval');
    lease.status = 'ACTIVE';
    lease.activatedAt = now();
    lease.activatedBy = actor.id;
    (lease.history ??= []).push({
      action: 'ACTIVATED',
      actorId: actor.id,
      at: now(),
      reason:
        'Approved and accepted lease activated; access remains date-bound',
    });
    listing.status = 'RENTED';
    this.generateCurrentObligations(lease);
    return { ...lease };
  }
  myLease(actor: AuthenticatedUser, id: string) {
    this.requireResident(actor);
    const lease = this.leases.find(
      (l) => l.id === id && l.tenantId === actor.id,
    );
    if (!lease) throw new NotFoundException('Lease was not found');
    this.refreshLease(lease);
    this.generateCurrentObligations(lease);
    return {
      ...lease,
      readOnly: lease.arrangement !== 'COMMUNITY',
      requiresReview:
        !lease.payeeId || (lease.status === 'ACTIVE' && !lease.adminApprovedBy),
      currentMonthlyRent: this.rentForPeriod(
        lease,
        new Date().toISOString().slice(0, 7),
      ),
      nextRentIncrease: this.nextRentIncrease(lease),
      obligations: this.obligations
        .filter((o) => o.leaseId === id)
        .map((o) => ({ ...o, outstandingBalance: this.outstanding(o) })),
      payments: this.payments.filter((p) => p.leaseId === id),
      refunds: this.paymentRefunds.filter((p) => p.leaseId === id),
      requests: this.requests.filter((r) => r.leaseId === id),
      amendments: this.amendments
        .filter((a) => a.leaseId === id)
        .map((a) => ({ ...a, terms: { ...a.terms } })),
      deposit: this.depositSummary(lease),
      reminders: this.reminders(lease),
    };
  }
  requestLifecycle(
    actor: AuthenticatedUser,
    leaseId: string,
    type: 'RENEWAL' | 'TERMINATION',
    renewalInput?: RenewalTermsDto,
  ) {
    this.requireResident(actor);
    const lease = this.leases.find(
      (l) => l.id === leaseId && l.tenantId === actor.id,
    );
    if (!lease) throw new NotFoundException('Lease was not found');
    this.assertSupportedRental(lease);
    this.refreshLease(lease);
    if (lease.status !== 'ACTIVE')
      throw new BadRequestException('Only an active lease can be changed');
    if (
      type === 'RENEWAL' &&
      this.requests.some(
        (request) =>
          request.leaseId === leaseId &&
          request.type === 'RENEWAL' &&
          request.status === 'APPROVED' &&
          request.successorLeaseId,
      )
    )
      throw new BadRequestException(
        'A renewal has already been approved for this lease',
      );
    if (
      this.requests.some((r) => r.leaseId === leaseId && r.status === 'PENDING')
    )
      throw new BadRequestException('A lease request is already pending');
    let renewalTerms: RenewalTermsDto | undefined;
    if (type === 'RENEWAL') {
      if (renewalInput) {
        if (
          typeof renewalInput !== 'object' ||
          Object.keys(renewalInput).some(
            (key) =>
              ![
                'startDate',
                'endDate',
                'monthlyRent',
                'securityDeposit',
                'dueDay',
                'escalation',
              ].includes(key),
          )
        )
          throw new BadRequestException('Invalid renewal request fields');
        if (renewalInput.startDate !== undefined)
          this.validDate(renewalInput.startDate);
        if (renewalInput.endDate !== undefined)
          this.validDate(renewalInput.endDate);
      }
      const startDate = renewalInput?.startDate
        ? this.dateOnly(renewalInput.startDate)
        : this.addUtcDays(this.dateOnly(lease.endDate), 1);
      const endDate = renewalInput?.endDate
        ? this.dateOnly(renewalInput.endDate)
        : this.addUtcDays(this.addUtcMonths(startDate, 12), -1);
      renewalTerms = {
        startDate,
        endDate,
        monthlyRent:
          renewalInput?.monthlyRent ??
          this.rentForPeriod(lease, this.dateOnly(lease.endDate).slice(0, 7)),
        securityDeposit: renewalInput?.securityDeposit ?? lease.securityDeposit,
        dueDay: renewalInput?.dueDay ?? lease.dueDay,
        escalation: renewalInput?.escalation
          ? { ...renewalInput.escalation }
          : undefined,
      };
      this.validateRenewalTerms(lease, renewalTerms);
    } else if (renewalInput && Object.keys(renewalInput).length)
      throw new BadRequestException(
        'Renewal terms are only valid on a renewal request',
      );
    const request: LifecycleRequest = {
      id: randomUUID(),
      leaseId,
      type,
      requestedBy: actor.id,
      status: 'PENDING',
      renewalTerms,
      createdAt: now(),
    };
    this.requests.push(request);
    return { ...request };
  }
  withdrawLifecycle(actor: AuthenticatedUser, requestId: string) {
    const request = this.requests.find((item) => item.id === requestId);
    if (!request) throw new NotFoundException('Lease request was not found');
    this.assertSupportedRental(
      this.leases.find((l) => l.id === request.leaseId)!,
    );
    if (actor.role !== RoleName.Resident || actor.id !== request.requestedBy)
      throw new ForbiddenException(
        'Only the resident who submitted the request can withdraw it',
      );
    if (request.status !== 'PENDING')
      throw new BadRequestException(
        'Only a pending lease request can be withdrawn',
      );
    request.status = 'WITHDRAWN';
    request.decidedAt = now();
    request.decidedBy = actor.id;
    return { ...request };
  }
  decideLifecycle(
    actor: AuthenticatedUser,
    requestId: string,
    decision: 'APPROVED' | 'DECLINED',
  ) {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) throw new NotFoundException('Lease request was not found');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Lease request has already been processed');
    const lease = this.leases.find((l) => l.id === request.leaseId)!;
    this.assertLeaseManager(actor, lease);
    this.refreshLease(lease);
    if (
      decision === 'APPROVED' &&
      request.type === 'RENEWAL' &&
      lease.status !== 'ACTIVE'
    )
      throw new BadRequestException(
        'An expired or terminated lease cannot be renewed',
      );
    let renewed: Lease | undefined;
    if (decision === 'APPROVED' && request.type === 'RENEWAL') {
      if (!request.renewalTerms)
        throw new BadRequestException('Renewal terms were not recorded');
      this.validateRenewalTerms(lease, request.renewalTerms);
      const terms = request.renewalTerms;
      renewed = {
        ...lease,
        depositCollected: 0,
        terminatedAt: undefined,
        adminApprovedBy: undefined,
        adminApprovedAt: undefined,
        activatedBy: undefined,
        activatedAt: undefined,
        history: [
          {
            action: 'RENEWAL_PROPOSED',
            actorId: actor.id,
            at: now(),
            reason: 'Successor lease needs new admin activation approval',
          },
        ],
        id: randomUUID(),
        monthlyRent: terms.monthlyRent,
        securityDeposit: terms.securityDeposit,
        dueDay: terms.dueDay,
        escalation: terms.escalation ? { ...terms.escalation } : undefined,
        predecessorLeaseId: lease.id,
        startDate: terms.startDate,
        endDate: terms.endDate,
        tenantAccepted: true,
        status: 'PENDING_APPROVAL',
        createdAt: now(),
      };
    }
    request.status = decision;
    request.decidedBy = actor.id;
    request.decidedAt = now();
    if (renewed) {
      this.leases.push(renewed);
      request.successorLeaseId = renewed.id;
    }
    if (decision === 'APPROVED' && request.type === 'TERMINATION') {
      this.generateCurrentObligations(lease);
      lease.status = 'TERMINATED';
      lease.terminatedAt = now();
      this.releaseListing(lease);
      (lease.history ??= []).push({
        action: 'TERMINATED',
        actorId: actor.id,
        at: now(),
        reason: 'Tenant termination request approved',
      });
    }
    return { ...request };
  }
  proposeAmendment(
    actor: AuthenticatedUser,
    leaseId: string,
    dto: RentAmendmentDto,
  ) {
    dto = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as RentAmendmentDto;
    const lease = this.leaseForManager(actor, leaseId);
    this.refreshLease(lease);
    if (lease.status !== 'ACTIVE')
      throw new BadRequestException(
        'Amendments can only be proposed for an active lease',
      );
    if (
      this.amendments.some(
        (item) =>
          item.leaseId === leaseId &&
          item.status === 'PENDING_TENANT_ACCEPTANCE',
      )
    )
      throw new BadRequestException(
        'A rent amendment is already awaiting tenant decision',
      );
    const terms: AmendmentTerms = {};
    if (dto.monthlyRent !== undefined) {
      this.validMoney(dto.monthlyRent, 'Monthly rent');
      terms.monthlyRent = dto.monthlyRent;
    }
    if (dto.securityDeposit !== undefined) {
      this.validMoney(dto.securityDeposit, 'Security deposit');
      terms.securityDeposit = dto.securityDeposit;
    }
    if (dto.dueDay !== undefined) {
      if (!Number.isInteger(dto.dueDay) || dto.dueDay < 1 || dto.dueDay > 31)
        throw new BadRequestException('Rent due day must be between 1 and 31');
      terms.dueDay = dto.dueDay;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'escalation')) {
      if (dto.escalation)
        this.validateEscalation(
          dto.escalation,
          dto.effectiveDate,
          lease.endDate,
        );
      terms.escalation = dto.escalation ? { ...dto.escalation } : null;
    }
    if (!Object.keys(terms).length)
      throw new BadRequestException(
        'An amendment must propose at least one lease term',
      );
    const effectiveDate = this.dateOnly(dto.effectiveDate),
      today = new Date().toISOString().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-01$/.test(effectiveDate) ||
      effectiveDate < today ||
      effectiveDate > this.dateOnly(lease.endDate)
    )
      throw new BadRequestException(
        'Amendment effective date must be a current or future first day within the lease term',
      );
    const latest = this.amendments
      .filter(
        (item) =>
          item.leaseId === leaseId &&
          ['ACCEPTED', 'APPLIED'].includes(item.status),
      )
      .map((item) => item.effectiveDate)
      .sort()
      .at(-1);
    if (latest && effectiveDate <= latest)
      throw new BadRequestException(
        'Amendment effective dates must follow previously accepted amendments',
      );
    if (terms.securityDeposit !== undefined) {
      const committed = this.depositEntries
        .filter(
          (item) =>
            item.leaseId === leaseId &&
            item.type === 'COLLECTION' &&
            item.status !== 'REJECTED',
        )
        .reduce((sum, item) => sum + toCents(item.amount), 0);
      if (toCents(terms.securityDeposit) < committed)
        throw new BadRequestException(
          'Agreed deposit cannot be reduced below submitted collection evidence',
        );
    }
    const amendment: Amendment = {
      id: randomUUID(),
      leaseId,
      proposedBy: actor.id,
      proposedAt: now(),
      effectiveDate,
      reason: dto.reason.trim(),
      terms,
      status: 'PENDING_TENANT_ACCEPTANCE',
    };
    this.amendments.push(amendment);
    return { ...amendment, terms: { ...terms } };
  }
  decideAmendment(
    actor: AuthenticatedUser,
    amendmentId: string,
    decision: 'ACCEPTED' | 'REJECTED',
  ) {
    const amendment = this.amendments.find((item) => item.id === amendmentId);
    if (!amendment) throw new NotFoundException('Rent amendment was not found');
    const lease = this.leases.find((item) => item.id === amendment.leaseId)!;
    this.assertSupportedRental(lease);
    if (actor.role !== RoleName.Resident || actor.id !== lease.tenantId)
      throw new ForbiddenException(
        'Only the lease tenant can decide this amendment',
      );
    if (amendment.status !== 'PENDING_TENANT_ACCEPTANCE')
      throw new BadRequestException('Rent amendment has already been decided');
    amendment.status = decision;
    amendment.decidedBy = actor.id;
    amendment.decidedAt = now();
    if (
      decision === 'ACCEPTED' &&
      amendment.effectiveDate <= new Date().toISOString().slice(0, 10)
    ) {
      amendment.status = 'APPLIED';
      amendment.appliedAt = now();
    }
    return { ...amendment, terms: { ...amendment.terms } };
  }
  withdrawAmendment(actor: AuthenticatedUser, amendmentId: string) {
    const amendment = this.amendments.find((item) => item.id === amendmentId);
    if (!amendment) throw new NotFoundException('Rent amendment was not found');
    const lease = this.leaseForManager(actor, amendment.leaseId);
    if (actor.id !== amendment.proposedBy || lease.status !== 'ACTIVE')
      throw new ForbiddenException(
        'Only the proposing authorized landlord can withdraw this amendment',
      );
    if (amendment.status !== 'PENDING_TENANT_ACCEPTANCE')
      throw new BadRequestException(
        'Only a pending amendment can be withdrawn',
      );
    amendment.status = 'WITHDRAWN';
    amendment.decidedBy = actor.id;
    amendment.decidedAt = now();
    return { ...amendment, terms: { ...amendment.terms } };
  }
  requestPayment(
    actor: AuthenticatedUser,
    leaseId: string,
    obligationId: string,
    dto: PaymentEvidenceDto,
  ) {
    this.requireResident(actor);
    const lease = this.leases.find(
      (l) => l.id === leaseId && l.tenantId === actor.id,
    );
    if (!lease) throw new NotFoundException('Lease was not found');
    this.assertSupportedRental(lease);
    if (!lease.payeeId)
      throw new ConflictException(
        'Rent payee is missing; authorized reconciliation is required',
      );
    this.validMoney(dto.amount, 'Payment amount', false);
    const obligation = this.obligations.find(
      (o) => o.id === obligationId && o.leaseId === lease.id,
    );
    if (!obligation)
      throw new NotFoundException('Rent obligation was not found');
    if (obligation.status === 'CANCELLED')
      throw new BadRequestException(
        'Payments cannot be recorded against a cancelled obligation',
      );
    this.assertUniqueTransactionReference(dto.transactionReference);
    const committed = this.committedPaymentTotal(obligation.id);
    if (
      toCents(dto.amount) >
      toCents(obligation.amountDue) - toCents(committed)
    )
      throw new BadRequestException('Payment exceeds the outstanding balance');
    const payment: Payment = {
      id: randomUUID(),
      leaseId,
      obligationId,
      payerId: actor.id,
      payeeId: lease.payeeId,
      amount: dto.amount,
      transactionReference: dto.transactionReference.trim(),
      status: 'PENDING_VERIFICATION',
      createdAt: now(),
    };
    this.payments.push(payment);
    return { ...payment };
  }
  verifyPayment(actor: AuthenticatedUser, paymentId: string) {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) throw new NotFoundException('Payment record was not found');
    const lease = this.leases.find((l) => l.id === payment.leaseId)!;
    this.assertLeaseManager(actor, lease);
    if (payment.status !== 'PENDING_VERIFICATION')
      throw new BadRequestException(
        'Payment evidence has already been processed',
      );
    const obligation = this.obligations.find(
      (o) => o.id === payment.obligationId,
    )!;
    const otherPending = fromCents(
      this.payments
        .filter(
          (p) =>
            p.obligationId === obligation.id &&
            p.id !== payment.id &&
            p.status === 'PENDING_VERIFICATION',
        )
        .reduce((n, p) => n + toCents(p.amount), 0),
    );
    if (
      toCents(payment.amount) >
      toCents(obligation.amountDue) -
        toCents(this.netPaidTotal(obligation.id)) -
        toCents(otherPending)
    )
      throw new BadRequestException(
        'Verified payment would exceed the outstanding balance',
      );
    payment.status = 'VERIFIED';
    return { ...payment };
  }
  reviewPayment(
    actor: AuthenticatedUser,
    paymentId: string,
    decision: 'VERIFIED' | 'REJECTED',
  ) {
    if (decision === 'VERIFIED') return this.verifyPayment(actor, paymentId);
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) throw new NotFoundException('Payment record was not found');
    const lease = this.leases.find((l) => l.id === payment.leaseId)!;
    this.assertLeaseManager(actor, lease);
    if (payment.status !== 'PENDING_VERIFICATION')
      throw new BadRequestException(
        'Payment evidence has already been processed',
      );
    payment.status = 'REJECTED';
    return { ...payment };
  }
  recordPaymentRefund(
    actor: AuthenticatedUser,
    paymentId: string,
    dto: DepositAdjustmentDto,
  ) {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) throw new NotFoundException('Payment record was not found');
    const lease = this.leases.find((l) => l.id === payment.leaseId)!;
    this.assertLeaseManager(actor, lease);
    this.validMoney(dto.amount, 'Refund amount', false);
    if (payment.status !== 'VERIFIED')
      throw new BadRequestException(
        'Only verified rent payments can be refunded',
      );
    if (!dto.transactionReference?.trim() || !dto.reason?.trim())
      throw new BadRequestException(
        'A refund reason and transaction reference are required',
      );
    this.validTransactionReference(dto.transactionReference);
    this.assertUniqueTransactionReference(dto.transactionReference);
    const refunded = fromCents(
      this.paymentRefunds
        .filter((x) => x.paymentId === paymentId && x.status !== 'REJECTED')
        .reduce((n, x) => n + toCents(x.amount), 0),
    );
    if (toCents(dto.amount) > toCents(payment.amount) - toCents(refunded))
      throw new BadRequestException(
        'Refund exceeds the unrefunded payment amount',
      );
    const refund: PaymentRefund = {
      id: randomUUID(),
      paymentId,
      leaseId: payment.leaseId,
      obligationId: payment.obligationId,
      amount: dto.amount,
      reason: dto.reason.trim(),
      transactionReference: dto.transactionReference.trim(),
      recordedBy: actor.id,
      status: 'PENDING_TENANT_CONFIRMATION',
      createdAt: now(),
    };
    this.paymentRefunds.push(refund);
    return { ...refund };
  }
  reviewPaymentRefund(
    actor: AuthenticatedUser,
    refundId: string,
    decision: 'VERIFIED' | 'REJECTED',
  ) {
    const refund = this.paymentRefunds.find((x) => x.id === refundId);
    if (!refund) throw new NotFoundException('Rent refund was not found');
    const lease = this.leases.find((l) => l.id === refund.leaseId)!;
    this.assertSupportedRental(lease);
    if (actor.role !== RoleName.Resident || actor.id !== lease.tenantId)
      throw new ForbiddenException(
        'Only the tenant can confirm the recorded rent refund',
      );
    if (refund.status !== 'PENDING_TENANT_CONFIRMATION')
      throw new BadRequestException('Refund has already been reviewed');
    refund.status = decision;
    return { ...refund };
  }
  submitDepositEvidence(
    actor: AuthenticatedUser,
    leaseId: string,
    dto: DepositEvidenceDto,
  ) {
    this.requireResident(actor);
    const lease = this.leases.find(
      (l) => l.id === leaseId && l.tenantId === actor.id,
    );
    if (!lease) throw new NotFoundException('Lease was not found');
    this.assertSupportedRental(lease);
    if (lease.status !== 'ACTIVE')
      throw new BadRequestException(
        'Deposit evidence can only be recorded for an active lease',
      );
    this.validMoney(dto.amount, 'Deposit collection', false);
    this.validTransactionReference(dto.transactionReference);
    this.assertUniqueTransactionReference(dto.transactionReference);
    const committed = this.depositEntries
      .filter(
        (x) =>
          x.leaseId === leaseId &&
          x.type === 'COLLECTION' &&
          x.status !== 'REJECTED',
      )
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    if (
      toCents(dto.amount) >
      toCents(
        this.securityDepositForPeriod(
          lease,
          new Date().toISOString().slice(0, 7),
        ),
      ) -
        committed
    )
      throw new BadRequestException(
        'Deposit collection exceeds the agreed deposit',
      );
    const entry: DepositEntry = {
      id: randomUUID(),
      leaseId,
      type: 'COLLECTION',
      amount: dto.amount,
      transactionReference: dto.transactionReference.trim(),
      recordedBy: actor.id,
      status: 'PENDING_VERIFICATION',
      createdAt: now(),
    };
    this.depositEntries.push(entry);
    return { ...entry };
  }
  recordDepositAdjustment(
    actor: AuthenticatedUser,
    leaseId: string,
    type: 'DEDUCTION' | 'REFUND',
    dto: DepositAdjustmentDto,
  ) {
    this.validMoney(dto.amount, 'Deposit adjustment', false);
    if (!dto.reason?.trim())
      throw new BadRequestException('A deposit adjustment reason is required');
    const lease = this.leaseForManager(actor, leaseId);
    this.refreshLease(lease);
    if (!['EXPIRED', 'TERMINATED'].includes(lease.status))
      throw new BadRequestException(
        'Deposit deductions and refunds require an expired or terminated lease',
      );
    const held = this.depositEntries
      .filter((x) => x.leaseId === leaseId && x.status === 'VERIFIED')
      .reduce(
        (sum, x) =>
          sum +
          (x.type === 'COLLECTION' ? toCents(x.amount) : -toCents(x.amount)),
        0,
      );
    const reserved = this.depositEntries
      .filter(
        (x) =>
          x.leaseId === leaseId &&
          ((x.type === 'REFUND' && x.status === 'PENDING_VERIFICATION') ||
            (x.type === 'DEDUCTION' &&
              ['PENDING_TENANT_CONFIRMATION', 'DISPUTED'].includes(x.status))),
      )
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    if (toCents(dto.amount) > held - reserved)
      throw new BadRequestException(
        'Adjustment exceeds the verified unallocated deposit balance',
      );
    if (type === 'DEDUCTION') {
      const entry: DepositEntry = {
        id: randomUUID(),
        leaseId,
        type,
        amount: dto.amount,
        reason: dto.reason.trim(),
        recordedBy: actor.id,
        status: 'PENDING_TENANT_CONFIRMATION',
        createdAt: now(),
      };
      this.depositEntries.push(entry);
      return { ...entry };
    }
    if (!dto.transactionReference?.trim())
      throw new BadRequestException('A refund reference is required');
    this.validTransactionReference(dto.transactionReference);
    this.assertUniqueTransactionReference(dto.transactionReference);
    const entry: DepositEntry = {
      id: randomUUID(),
      leaseId,
      type,
      amount: dto.amount,
      reason: dto.reason.trim(),
      transactionReference: dto.transactionReference.trim(),
      recordedBy: actor.id,
      status: 'PENDING_VERIFICATION',
      createdAt: now(),
    };
    this.depositEntries.push(entry);
    return { ...entry };
  }
  reviewDeposit(
    actor: AuthenticatedUser,
    entryId: string,
    decision: 'VERIFIED' | 'REJECTED',
  ) {
    const entry = this.depositEntries.find((x) => x.id === entryId);
    if (!entry)
      throw new NotFoundException('Deposit transaction was not found');
    const lease = this.leases.find((l) => l.id === entry.leaseId)!;
    this.assertSupportedRental(lease);
    if (entry.status !== 'PENDING_VERIFICATION')
      throw new BadRequestException(
        'Deposit transaction has already been processed',
      );
    if (entry.type === 'COLLECTION') this.assertLeaseManager(actor, lease);
    else if (actor.role !== RoleName.Resident || actor.id !== lease.tenantId)
      throw new ForbiddenException(
        'Only the tenant can confirm a recorded deposit refund',
      );
    entry.status = decision;
    return { ...entry };
  }
  decideDepositDeduction(
    actor: AuthenticatedUser,
    entryId: string,
    dto: DepositDeductionDecisionDto,
  ) {
    const entry = this.depositEntries.find((item) => item.id === entryId);
    if (!entry || entry.type !== 'DEDUCTION')
      throw new NotFoundException('Proposed deposit deduction was not found');
    const lease = this.leases.find((item) => item.id === entry.leaseId)!;
    this.assertSupportedRental(lease);
    if (actor.role !== RoleName.Resident || actor.id !== lease.tenantId)
      throw new ForbiddenException(
        'Only the lease tenant can accept or dispute this deduction',
      );
    if (entry.status !== 'PENDING_TENANT_CONFIRMATION')
      throw new BadRequestException(
        'Deposit deduction is no longer awaiting tenant decision',
      );
    if (dto.decision === 'DISPUTED' && !dto.reason?.trim())
      throw new BadRequestException('A dispute reason is required');
    entry.status = dto.decision === 'ACCEPTED' ? 'VERIFIED' : 'DISPUTED';
    entry.disputeReason =
      dto.decision === 'DISPUTED' ? dto.reason!.trim() : undefined;
    entry.decisionBy = actor.id;
    entry.decisionAt = now();
    return { ...entry };
  }
  resolveDepositDispute(
    actor: AuthenticatedUser,
    entryId: string,
    dto: DepositDisputeResolutionDto,
  ) {
    const entry = this.depositEntries.find((item) => item.id === entryId);
    if (!entry || entry.type !== 'DEDUCTION')
      throw new NotFoundException('Deposit deduction was not found');
    this.leaseForManager(actor, entry.leaseId);
    if (entry.status !== 'DISPUTED')
      throw new BadRequestException(
        'Only a disputed deduction can be resolved',
      );
    entry.status = dto.decision;
    entry.resolutionReason = dto.reason.trim();
    entry.resolvedBy = actor.id;
    entry.resolvedAt = now();
    return { ...entry };
  }
  private depositSummary(lease: Lease) {
    const history = this.depositEntries
      .filter((x) => x.leaseId === lease.id)
      .map((x) => ({ ...x }));
    const collectedCents = history
      .filter((x) => x.type === 'COLLECTION' && x.status === 'VERIFIED')
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    const deductionsCents = history
      .filter((x) => x.type === 'DEDUCTION' && x.status === 'VERIFIED')
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    const refundedCents = history
      .filter((x) => x.type === 'REFUND' && x.status === 'VERIFIED')
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    const pendingRefundCents = history
      .filter((x) => x.type === 'REFUND' && x.status === 'PENDING_VERIFICATION')
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    const pendingDeductionsCents = history
      .filter(
        (x) =>
          x.type === 'DEDUCTION' &&
          ['PENDING_TENANT_CONFIRMATION', 'DISPUTED'].includes(x.status),
      )
      .reduce((sum, x) => sum + toCents(x.amount), 0);
    const collected = fromCents(collectedCents),
      deductions = fromCents(deductionsCents),
      refunded = fromCents(refundedCents),
      pendingRefund = fromCents(pendingRefundCents);
    const held = fromCents(
      Math.max(0, collectedCents - deductionsCents - refundedCents),
    );
    const currentAgreement = this.securityDepositForPeriod(
      lease,
      new Date().toISOString().slice(0, 7),
    );
    const status =
      currentAgreement === 0
        ? 'NOT_REQUIRED'
        : collectedCents === 0
          ? 'UNPAID'
          : held === 0
            ? refunded
              ? 'REFUNDED'
              : 'DEDUCTED'
            : collectedCents < toCents(currentAgreement)
              ? 'PARTIALLY_COLLECTED'
              : refunded
                ? 'PARTIALLY_REFUNDED'
                : 'HELD';
    return {
      agreed: currentAgreement,
      collected,
      deductions,
      pendingDeductions: fromCents(pendingDeductionsCents),
      refunded,
      pendingRefund,
      held,
      status,
      history,
    };
  }
  private reminders(lease: Lease) {
    const today = new Date().toISOString().slice(0, 10);
    const soon = this.addUtcDays(today, 7);
    const expiry = this.addUtcDays(today, 60);
    const obligations = this.obligations.filter(
      (o) => o.leaseId === lease.id && o.amountDue > o.amountPaid,
    );
    return {
      upcomingRent: obligations
        .filter(
          (o) =>
            this.dateOnly(o.dueDate) >= today &&
            this.dateOnly(o.dueDate) <= soon,
        )
        .map((o) => ({
          obligationId: o.id,
          dueDate: o.dueDate,
          outstandingBalance: this.outstanding(o),
        })),
      overdueRent: obligations
        .filter((o) => this.dateOnly(o.dueDate) < today)
        .map((o) => ({
          obligationId: o.id,
          dueDate: o.dueDate,
          outstandingBalance: this.outstanding(o),
        })),
      leaseExpiry:
        lease.status === 'ACTIVE' &&
        this.dateOnly(lease.endDate) >= today &&
        this.dateOnly(lease.endDate) <= expiry
          ? lease.endDate
          : null,
      delivery: 'IN_APP_ONLY',
    };
  }
  private leaseForManager(actor: AuthenticatedUser, leaseId: string) {
    const lease = this.leases.find((l) => l.id === leaseId);
    if (!lease) throw new NotFoundException('Lease was not found');
    this.assertLeaseManager(actor, lease);
    return lease;
  }
  private validTransactionReference(reference: string) {
    if (
      typeof reference !== 'string' ||
      !reference.trim() ||
      reference.trim().length > 120
    )
      throw new BadRequestException(
        'Transaction reference must contain 1 to 120 characters',
      );
  }
  private assertUniqueTransactionReference(reference: string) {
    this.validTransactionReference(reference);
    const value = reference.trim().toLocaleLowerCase('en-IN');
    if (
      this.payments.some(
        (x) => x.transactionReference.toLocaleLowerCase('en-IN') === value,
      ) ||
      this.depositEntries.some(
        (x) => x.transactionReference?.toLocaleLowerCase('en-IN') === value,
      ) ||
      this.paymentRefunds.some(
        (x) => x.transactionReference.toLocaleLowerCase('en-IN') === value,
      )
    )
      throw new BadRequestException(
        'Transaction reference has already been recorded',
      );
  }
  private netPaidTotal(obligationId: string) {
    const received = this.payments
      .filter((p) => p.obligationId === obligationId && p.status === 'VERIFIED')
      .reduce((n, p) => n + toCents(p.amount), 0);
    const refunded = this.paymentRefunds
      .filter((p) => p.obligationId === obligationId && p.status === 'VERIFIED')
      .reduce((n, p) => n + toCents(p.amount), 0);
    return Math.max(0, fromCents(received - refunded));
  }
  private committedPaymentTotal(obligationId: string) {
    const committed = this.payments
      .filter((p) => p.obligationId === obligationId && p.status !== 'REJECTED')
      .reduce((n, p) => n + toCents(p.amount), 0);
    const refunded = this.paymentRefunds
      .filter((p) => p.obligationId === obligationId && p.status === 'VERIFIED')
      .reduce((n, p) => n + toCents(p.amount), 0);
    return Math.max(0, fromCents(committed - refunded));
  }
  private outstanding(obligation: Obligation) {
    return Math.max(
      0,
      fromCents(toCents(obligation.amountDue) - toCents(obligation.amountPaid)),
    );
  }
  private generateCurrentObligations(lease: Lease) {
    // Lease dates are date-only ISO values interpreted in UTC. End dates are inclusive.
    // Billing is one full calendar-month rent per touched month; proration is unsupported.
    if (
      lease.arrangement !== 'COMMUNITY' ||
      !['ACTIVE', 'EXPIRED', 'TERMINATED'].includes(lease.status) ||
      !lease.payeeId ||
      !lease.adminApprovedBy ||
      lease.startDate > new Date().toISOString().slice(0, 10)
    )
      return;
    this.refreshAmendments(lease);
    const start = new Date(`${lease.startDate.slice(0, 10)}T00:00:00.000Z`),
      end = new Date(`${lease.endDate.slice(0, 10)}T00:00:00.000Z`),
      today = new Date();
    const period = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
    );
    while (
      period <= today &&
      period <= end &&
      (!lease.terminatedAt || period <= new Date(lease.terminatedAt))
    ) {
      const key = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, '0')}`;
      if (
        !this.obligations.some(
          (o) => o.leaseId === lease.id && o.billingPeriod === key,
        )
      ) {
        const lastDay = new Date(
          Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0),
        ).getUTCDate();
        const due = new Date(
          Date.UTC(
            period.getUTCFullYear(),
            period.getUTCMonth(),
            Math.min(this.dueDayForPeriod(lease, key), lastDay),
            23,
            59,
            59,
            999,
          ),
        );
        if (due < start)
          due.setTime(
            Date.UTC(
              start.getUTCFullYear(),
              start.getUTCMonth(),
              start.getUTCDate(),
              23,
              59,
              59,
              999,
            ),
          );
        this.obligations.push({
          payeeId: lease.payeeId,
          id: randomUUID(),
          leaseId: lease.id,
          billingPeriod: key,
          amountDue: this.rentForPeriod(lease, key),
          dueDate: due.toISOString(),
          amountPaid: 0,
          status: due < today ? 'OVERDUE' : 'PENDING',
        });
      }
      period.setUTCMonth(period.getUTCMonth() + 1);
    }
    for (const o of this.obligations.filter((x) => x.leaseId === lease.id)) {
      o.amountPaid = this.netPaidTotal(o.id);
      o.status =
        o.amountDue === 0
          ? 'NOT_REQUIRED'
          : o.amountPaid >= o.amountDue
            ? 'PAID'
            : o.amountPaid > 0
              ? 'PARTIALLY_PAID'
              : Date.parse(o.dueDate) < Date.now()
                ? 'OVERDUE'
                : 'PENDING';
    }
  }
  private refreshLease(lease: Lease) {
    if (
      lease.status === 'ACTIVE' &&
      this.dateOnly(lease.endDate) < new Date().toISOString().slice(0, 10)
    ) {
      this.generateCurrentObligations(lease);
      lease.status = 'EXPIRED';
      this.releaseListing(lease);
      (lease.history ??= []).push({
        action: 'EXPIRED',
        actorId: 'system',
        at: now(),
        reason: 'Inclusive lease end date passed; historical records retained',
      });
    }
  }
  private presentListing(item: Listing) {
    const apartment = this.community.getApartment(item.apartmentId);
    return {
      ...item,
      readOnly: item.arrangement !== 'COMMUNITY',
      requiresReview:
        !item.payeeId ||
        (item.arrangement === 'OWNER' &&
          item.status === 'AVAILABLE' &&
          !item.reviewedBy),
      apartmentNumber: apartment.apartmentNumber,
      apartmentLabel: apartment.label,
    };
  }
  private refreshRentals() {
    this.leases.forEach((lease) => this.refreshLease(lease));
  }
  private listing(id: string) {
    const value = this.listings.find((x) => x.id === id);
    if (!value) throw new NotFoundException('Rental listing was not found');
    return value;
  }
  private assertManager(actor: AuthenticatedUser, listing: Listing) {
    this.assertCommunityAdmin(actor, listing.communityId);
    this.assertSupportedRental(listing);
  }
  private canManage(actor: AuthenticatedUser, listing: Listing) {
    if (
      actor.role === RoleName.Resident &&
      listing.arrangement === 'OWNER' &&
      listing.landlordId === actor.id
    )
      return true;
    try {
      this.assertCommunityAdmin(actor, listing.communityId);
      return true;
    } catch {
      return false;
    }
  }
  private assertCommunityAdmin(actor: AuthenticatedUser, communityId: string) {
    if (
      actor.role !== RoleName.CommunityAdmin ||
      this.users.findById(actor.id).communityId !== communityId
    )
      throw new ForbiddenException('Community rental access is restricted');
  }
  private requireResident(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.Resident)
      throw new ForbiddenException('Resident access required');
  }
  private validDate(value: string) {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value))
    )
      throw new BadRequestException('A valid date is required');
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('A valid calendar date is required');
  }
  private dateOnly(value: string) {
    return value.slice(0, 10);
  }
  private addUtcDays(value: string, days: number) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  private addUtcMonths(value: string, months: number) {
    const [year, month, day] = value.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return target.toISOString().slice(0, 10);
  }
  private validateRenewalTerms(lease: Lease, terms: RenewalTermsDto) {
    const availableUntil = this.listing(lease.listingId).availableUntil;
    if (availableUntil && terms.endDate > availableUntil)
      throw new BadRequestException(
        'Renewal exceeds owner-approved rental period',
      );
    this.validDate(terms.startDate);
    this.validDate(terms.endDate);
    this.validMoney(terms.monthlyRent, 'Renewal monthly rent');
    this.validMoney(terms.securityDeposit, 'Renewal security deposit');
    const start = this.dateOnly(terms.startDate),
      end = this.dateOnly(terms.endDate);
    if (start <= this.dateOnly(lease.endDate) || end < start)
      throw new BadRequestException(
        'Renewal must begin after the existing inclusive lease end date and end on or after its start',
      );
    if (
      !Number.isInteger(terms.dueDay) ||
      terms.dueDay < 1 ||
      terms.dueDay > 31
    )
      throw new BadRequestException(
        'Renewal rent due day must be between 1 and 31',
      );
    if (terms.escalation) this.validateEscalation(terms.escalation, start, end);
    this.assertNoLeaseOverlap(lease.apartmentId, start, end, lease.id);
  }
  private assertNoLeaseOverlap(
    apartmentId: string,
    start: string,
    end: string,
    exceptLeaseId?: string,
  ) {
    if (
      this.leases.some(
        (other) =>
          other.id !== exceptLeaseId &&
          other.apartmentId === apartmentId &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(other.status) &&
          start <= this.dateOnly(other.endDate) &&
          end >= this.dateOnly(other.startDate),
      )
    )
      throw new BadRequestException(
        'Lease dates overlap an active or proposed lease for this apartment',
      );
  }
  private validMoney(value: number, label: string, allowZero = true) {
    const minorUnits = value * 100;
    if (
      !Number.isFinite(value) ||
      value > MAX_RENTAL_AMOUNT ||
      (allowZero ? value < 0 : value <= 0) ||
      Math.abs(minorUnits - Math.round(minorUnits)) > 1e-7
    )
      throw new BadRequestException(
        `${label} must be a valid INR amount with at most two decimal places`,
      );
  }
  private validateEscalation(
    term: RentEscalationDto,
    start: string,
    end: string,
  ) {
    if (!term || !['PERCENTAGE', 'FIXED'].includes(term.method))
      throw new BadRequestException(
        'Rent escalation method must be PERCENTAGE or FIXED',
      );
    this.validMoney(term.value, 'Rent escalation', true);
    if (
      !Number.isInteger(term.intervalMonths) ||
      term.intervalMonths < 1 ||
      term.intervalMonths > 120
    )
      throw new BadRequestException(
        'Rent escalation interval must be from 1 to 120 months',
      );
    if (term.method === 'PERCENTAGE' && term.value > 1000)
      throw new BadRequestException(
        'Rent escalation percentage is outside the supported range',
      );
    if (term.method === 'FIXED' && term.value <= 0)
      throw new BadRequestException(
        'A fixed rent increase must be greater than zero',
      );
    if (
      typeof term.effectiveDate !== 'string' ||
      !Number.isFinite(Date.parse(term.effectiveDate))
    )
      throw new BadRequestException(
        'Rent escalation effective date must be valid',
      );
    const effective = this.dateOnly(term.effectiveDate);
    if (
      !/^\d{4}-\d{2}-01$/.test(effective) ||
      effective <= this.dateOnly(start) ||
      effective > this.dateOnly(end)
    )
      throw new BadRequestException(
        'Rent escalation must begin on the first day of a month within the lease term and after commencement',
      );
    if (
      term.maxIncreases !== undefined &&
      (!Number.isInteger(term.maxIncreases) ||
        term.maxIncreases < 1 ||
        term.maxIncreases > 100)
    )
      throw new BadRequestException(
        'Rent escalation increase count must be from 1 to 100',
      );
  }
  private escalationDates(
    term: RentEscalationDto | undefined,
    endDate: string,
  ) {
    if (!term) return [] as string[];
    const dates: string[] = [];
    let date = this.dateOnly(term.effectiveDate);
    while (date <= endDate && dates.length < (term.maxIncreases ?? 100)) {
      dates.push(date);
      date = this.addUtcMonths(date, term.intervalMonths);
    }
    return dates;
  }
  private rentAfterEscalation(
    baseRent: number,
    term: RentEscalationDto | undefined,
    afterDate: string,
    targetDate: string,
    endDate: string,
  ) {
    let cents = toCents(baseRent);
    const dates = this.escalationDates(term, endDate);
    dates.forEach((date) => {
      if (date > afterDate && date <= targetDate) {
        cents =
          term!.method === 'PERCENTAGE'
            ? Math.round((cents * (100 + term!.value)) / 100)
            : cents + toCents(term!.value);
        if (cents < 0 || cents > toCents(MAX_RENTAL_AMOUNT))
          throw new BadRequestException(
            'Scheduled rent exceeds the supported amount',
          );
      }
    });
    return fromCents(cents);
  }
  private acceptedAmendments(lease: Lease) {
    return this.amendments
      .filter(
        (item) =>
          item.leaseId === lease.id &&
          ['ACCEPTED', 'APPLIED'].includes(item.status),
      )
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  }
  private rentForPeriod(lease: Lease, period: string) {
    const targetDate = `${period}-01`;
    let rent = lease.monthlyRent,
      escalation = lease.escalation,
      segmentStart = this.dateOnly(lease.startDate);
    for (const amendment of this.acceptedAmendments(lease).filter(
      (item) => item.effectiveDate.slice(0, 7) <= period,
    )) {
      rent = this.rentAfterEscalation(
        rent,
        escalation,
        segmentStart,
        this.addUtcDays(amendment.effectiveDate, -1),
        this.dateOnly(lease.endDate),
      );
      if (amendment.terms.monthlyRent !== undefined)
        rent = amendment.terms.monthlyRent;
      if (Object.prototype.hasOwnProperty.call(amendment.terms, 'escalation'))
        escalation = amendment.terms.escalation ?? undefined;
      segmentStart = amendment.effectiveDate;
    }
    return this.rentAfterEscalation(
      rent,
      escalation,
      segmentStart,
      targetDate,
      this.dateOnly(lease.endDate),
    );
  }
  private dueDayForPeriod(lease: Lease, period: string) {
    return (
      this.acceptedAmendments(lease)
        .filter(
          (item) =>
            item.effectiveDate.slice(0, 7) <= period &&
            item.terms.dueDay !== undefined,
        )
        .at(-1)?.terms.dueDay ?? lease.dueDay
    );
  }
  private securityDepositForPeriod(lease: Lease, period: string) {
    return (
      this.acceptedAmendments(lease)
        .filter(
          (item) =>
            item.effectiveDate.slice(0, 7) <= period &&
            item.terms.securityDeposit !== undefined,
        )
        .at(-1)?.terms.securityDeposit ?? lease.securityDeposit
    );
  }
  private refreshAmendments(lease: Lease) {
    const today = new Date().toISOString().slice(0, 10);
    this.amendments
      .filter(
        (item) =>
          item.leaseId === lease.id &&
          item.status === 'ACCEPTED' &&
          item.effectiveDate <= today,
      )
      .forEach((item) => {
        item.status = 'APPLIED';
        item.appliedAt = now();
      });
  }
  private nextRentIncrease(lease: Lease) {
    const currentPeriod = new Date().toISOString().slice(0, 7);
    const dates = [
      ...this.escalationDates(lease.escalation, this.dateOnly(lease.endDate)),
      ...this.acceptedAmendments(lease).flatMap((item) => [
        item.effectiveDate,
        ...this.escalationDates(
          item.terms.escalation ?? undefined,
          this.dateOnly(lease.endDate),
        ),
      ]),
    ]
      .filter((date) => date.slice(0, 7) > currentPeriod)
      .sort();
    const date = dates.find(
      (item, index) =>
        index === 0 ||
        this.rentForPeriod(lease, item.slice(0, 7)) !==
          this.rentForPeriod(lease, this.addUtcDays(item, -1).slice(0, 7)),
    );
    return date
      ? { date, amount: this.rentForPeriod(lease, date.slice(0, 7)) }
      : null;
  }
  onboardTenant(actor: AuthenticatedUser, dto: OnboardTenantDto) {
    const listing = this.listing(dto.listingId);
    this.assertCommunityAdmin(actor, listing.communityId);
    this.assertSupportedRental(listing);
    if (Boolean(dto.existingTenantId) === Boolean(dto.account))
      throw new BadRequestException(
        'Choose an existing resident or provide new account details, not both',
      );
    const fingerprint = createHash('sha256')
        .update(JSON.stringify(dto))
        .digest('hex'),
      key = actor.id + ':' + dto.clientRequestId,
      prior = this.onboardingRetries.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ConflictException(
          'Retry ID reused with different onboarding details',
        );
      return { ...this.leases.find((l) => l.id === prior.leaseId)! };
    }
    this.validDate(dto.startDate);
    this.validDate(dto.endDate);
    if (dto.startDate >= dto.endDate)
      throw new BadRequestException('Lease end must follow start');
    if (listing.status !== 'AVAILABLE')
      throw new ConflictException('Listing is not available');
    this.assertNoLeaseOverlap(listing.apartmentId, dto.startDate, dto.endDate);
    if (dto.account && dto.account.role !== RoleName.Resident)
      throw new BadRequestException(
        'Tenant accounts must use the existing RESIDENT role',
      );
    let createdId: string | undefined;
    const oldStatus = listing.status,
      oldLength = this.leases.length;
    try {
      let tenantId = dto.existingTenantId;
      if (dto.account) {
        if (!this.accounts)
          throw new BadRequestException('Account creation service unavailable');
        const created = this.accounts.create(actor, {
          ...dto.account,
          role: RoleName.Resident,
          residentSituation: 'TENANT_PENDING',
          apartmentId: listing.apartmentId,
          communityId: undefined,
          towerId: undefined,
        });
        createdId = created.id;
        tenantId = created.id;
      }
      const lease = this.createLease(actor, {
        listingId: listing.id,
        tenantId: tenantId!,
        startDate: dto.startDate,
        endDate: dto.endDate,
        dueDay: dto.dueDay,
      });
      this.reviewLease(
        actor,
        lease.id,
        'APPROVED',
        'Admin tenant onboarding approval; awaiting tenant acceptance',
      );
      this.onboardingRetries.set(key, { fingerprint, leaseId: lease.id });
      return { ...lease, adminApprovedBy: actor.id };
    } catch (error) {
      this.leases.splice(oldLength);
      listing.status = oldStatus;
      if (createdId) this.users.delete(createdId);
      throw error;
    }
  }
  reviewLease(
    actor: AuthenticatedUser,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
  ) {
    const lease = this.leases.find((l) => l.id === id);
    if (!lease) throw new NotFoundException('Lease was not found');
    this.assertCommunityAdmin(actor, lease.communityId);
    this.assertSupportedRental(lease);
    if (!reason.trim())
      throw new BadRequestException('A review reason is required');
    if (
      decision === 'APPROVED' &&
      lease.adminApprovedBy &&
      ['PENDING_APPROVAL', 'ACTIVE'].includes(lease.status)
    )
      return { ...lease };
    if (lease.status !== 'PENDING_APPROVAL')
      throw new ConflictException('Lease is no longer pending');
    if (decision === 'APPROVED') {
      this.assertNoLeaseOverlap(
        lease.apartmentId,
        lease.startDate,
        lease.endDate,
        lease.id,
      );
      lease.adminApprovedBy = actor.id;
      lease.adminApprovedAt = now();
    } else {
      lease.status = 'CANCELLED';
      this.releaseListing(lease);
    }
    (lease.history ??= []).push({
      action: decision,
      actorId: actor.id,
      at: now(),
      reason: reason.trim(),
    });
    return { ...lease };
  }
  cancelProposal(actor: AuthenticatedUser, id: string, reason: string) {
    const lease = this.leaseForManager(actor, id);
    if (lease.status !== 'PENDING_APPROVAL')
      throw new ConflictException('Only a proposed lease can be cancelled');
    if (!reason.trim()) throw new BadRequestException('Reason required');
    lease.status = 'CANCELLED';
    (lease.history ??= []).push({
      action: 'CANCELLED',
      actorId: actor.id,
      at: now(),
      reason: reason.trim(),
    });
    this.releaseListing(lease);
    return { ...lease };
  }
  inventory(actor: AuthenticatedUser) {
    const user = this.users.findById(actor.id);
    return this.community
      .listApartments()
      .filter((a) =>
        actor.role === RoleName.CommunityAdmin
          ? this.community.getTower(this.community.getFloor(a.floorId).towerId)
              .communityId === user.communityId
          : a.ownerUserId === actor.id ||
            (() => {
              try {
                return this.resolveOccupancy(actor.id, a.id) === a.id;
              } catch {
                return false;
              }
            })(),
      )
      .map((a) => {
        const today = new Date().toISOString().slice(0, 10);
        const lease = this.leases.find(
          (l) =>
            l.apartmentId === a.id &&
            l.status === 'ACTIVE' &&
            l.startDate <= today &&
            l.endDate >= today,
        );
        const legacy = this.users
          .findAll()
          .filter(
            (u) =>
              u.role === RoleName.Resident &&
              u.apartmentId === a.id &&
              !u.residentSituation &&
              !this.leases.some((l) => l.tenantId === u.id),
          );
        return {
          ...a,
          occupancy: lease
            ? lease.arrangement === 'OWNER'
              ? 'PRIVATE_TENANT'
              : 'COMMUNITY_TENANT'
            : a.ownerUserId
              ? legacy.some((u) => u.id !== a.ownerUserId)
                ? 'REVIEW_REQUIRED'
                : 'OWNER_OCCUPIED'
              : legacy.length
                ? 'REVIEW_REQUIRED'
                : 'VACANT',
          occupantId:
            lease?.tenantId ??
            (legacy.some((u) => u.id !== a.ownerUserId)
              ? null
              : a.ownerUserId) ??
            null,
          leaseId: lease?.id ?? null,
        };
      });
  }
  assignOwner(actor: AuthenticatedUser, apartmentId: string, userId: string) {
    const apartment = this.community.getApartment(apartmentId),
      communityId = this.community.getTower(
        this.community.getFloor(apartment.floorId).towerId,
      ).communityId;
    this.assertCommunityAdmin(actor, communityId);
    const owner = this.users.findById(userId);
    if (
      owner.role !== RoleName.Resident ||
      this.communityForUser(owner) !== communityId
    )
      throw new BadRequestException(
        'Owner must be an existing same-community resident',
      );
    if (apartment.ownerUserId === userId) return { ...apartment };
    this.assertOwnerAssignment(apartmentId, userId);
    this.community.transferApartmentOwnershipForActor(actor, apartmentId, {
      expectedOwnerUserId: null,
      newOwnerUserId: userId,
      reason: 'Owner-occupant assignment',
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
    return { ...this.community.getApartment(apartmentId) };
  }
  private assertOwnerAssignment(apartmentId: string, userId?: string) {
    const apartment = this.community.getApartment(apartmentId);
    if (apartment.ownerUserId && apartment.ownerUserId !== userId)
      throw new ConflictException('Apartment already has an owner');
    this.assertApartmentMutable(apartmentId);
    if (
      this.users
        .findAll()
        .some(
          (u) =>
            u.role === RoleName.Resident &&
            u.id !== userId &&
            u.apartmentId === apartmentId &&
            u.residentSituation !== 'TENANT_PENDING',
        )
    )
      throw new ConflictException(
        'Apartment has an occupant requiring reconciliation',
      );
  }
  private assertApartmentMutable(id: string) {
    this.leases.forEach((lease) => this.refreshLease(lease));
    const today = new Date().toISOString().slice(0, 10);
    if (
      this.listings.some(
        (l) =>
          l.apartmentId === id &&
          [
            'PENDING_ADMIN_APPROVAL',
            'AVAILABLE',
            'RESERVED',
            'RENTED',
          ].includes(l.status),
      ) ||
      this.leases.some(
        (l) =>
          l.apartmentId === id &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status) &&
          l.endDate >= today,
      )
    )
      throw new ConflictException(
        'Withdraw rental requests and settle active/proposed occupancy before changing this apartment',
      );
  }
  private assertUserMutable(id: string, target?: string) {
    if (
      this.leases.some((l) => l.tenantId === id || l.landlordId === id) ||
      this.listings.some((l) => l.landlordId === id) ||
      this.community.listApartments().some((a) => a.ownerUserId === id)
    )
      throw new ConflictException(
        'Rental and ownership relationships require explicit lifecycle handling; account reassignment/deletion is blocked',
      );
    if (
      target &&
      this.leases.some(
        (l) =>
          l.apartmentId === target &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status) &&
          l.endDate >= new Date().toISOString().slice(0, 10),
      )
    )
      throw new ConflictException('Target apartment has a rental arrangement');
  }
  private resolveOccupancy(
    userId: string,
    apartmentId?: string,
    startsAt?: string,
    endsAt?: string,
  ) {
    const user = this.users.findById(userId);
    if (user.role !== RoleName.Resident)
      throw new ForbiddenException('Resident occupancy required');
    const start = startsAt ? Date.parse(startsAt) : Date.now(),
      end = endsAt ? Date.parse(endsAt) : start + 1;
    const overlaps = (l: Lease) =>
      l.status === 'ACTIVE' &&
      Date.parse(l.startDate + 'T00:00:00Z') < end &&
      Date.parse(l.endDate + 'T23:59:59.999Z') >= start;
    const covers = (l: Lease) =>
      Boolean(l.adminApprovedBy) &&
      l.tenantAccepted &&
      l.startDate <= new Date().toISOString().slice(0, 10) &&
      l.endDate >= new Date().toISOString().slice(0, 10) &&
      overlaps(l) &&
      Date.parse(l.startDate + 'T00:00:00Z') <= start &&
      Date.parse(l.endDate + 'T23:59:59.999Z') >= end - 1;
    const owned = this.community
      .listApartments()
      .filter((a) => a.ownerUserId === userId)
      .map((a) => a.id);
    const candidates = apartmentId
      ? [apartmentId]
      : [
          ...this.leases
            .filter((l) => l.tenantId === userId && covers(l))
            .map((l) => l.apartmentId),
          ...(user.apartmentId ? [user.apartmentId] : []),
          ...owned,
        ];
    for (const id of [...new Set(candidates)]) {
      const current = this.leases.filter(
        (l) => l.apartmentId === id && overlaps(l),
      );
      if (current.length) {
        if (
          current.length === 1 &&
          current[0].tenantId === userId &&
          covers(current[0])
        )
          return id;
        continue;
      }
      if (
        owned.includes(id) &&
        !this.leases.some(
          (l) =>
            l.apartmentId === id &&
            l.status === 'ACTIVE' &&
            l.startDate <= new Date().toISOString().slice(0, 10) &&
            l.endDate >= new Date().toISOString().slice(0, 10),
        ) &&
        !this.users
          .findAll()
          .some(
            (u) =>
              u.id !== userId &&
              u.role === RoleName.Resident &&
              u.apartmentId === id &&
              !u.residentSituation &&
              !this.leases.some((l) => l.tenantId === u.id),
          )
      )
        return id;
      if (
        id === user.apartmentId &&
        !this.community.getApartment(id).ownerUserId &&
        !user.residentSituation &&
        !this.leases.some(
          (l) =>
            l.tenantId === userId &&
            l.startDate <= new Date().toISOString().slice(0, 10) &&
            ['ACTIVE', 'EXPIRED', 'TERMINATED'].includes(l.status),
        )
      )
        return id;
    }
    throw new ForbiddenException(
      'No eligible occupant relationship for the requested apartment and dates; ownership alone does not grant access while rented',
    );
  }
  private assertHandover(lease: Lease) {
    const start = lease.startDate + 'T00:00:00.000Z',
      end = lease.endDate + 'T23:59:59.999Z';
    this.community.assertOccupancyHandover?.(lease.apartmentId, start, end);
    this.assertNoUnverifiedOccupants(lease.apartmentId, lease.tenantId);
  }
  private assertNoUnverifiedOccupants(apartmentId: string, tenantId?: string) {
    const a = this.community.getApartment(apartmentId);
    const conflicts = this.users
      .findAll?.()
      .filter(
        (u) =>
          u.role === RoleName.Resident &&
          u.apartmentId === a.id &&
          u.id !== tenantId &&
          u.id !== a.ownerUserId &&
          !u.residentSituation &&
          !this.leases.some(
            (l) => l.tenantId === u.id && l.apartmentId === a.id,
          ),
      );
    if (conflicts?.length)
      throw new ConflictException(
        'Existing apartment occupants require explicit admin reconciliation before activation',
      );
  }
  private assertSupportedRental(record: { arrangement: string }) {
    if (record.arrangement !== 'COMMUNITY')
      throw new GoneException(
        'Legacy private rental records are read-only; private arrangements are managed outside Urbanity',
      );
  }
  private assertLeaseManager(actor: AuthenticatedUser, lease: Lease) {
    this.assertLeaseAccess(actor, lease);
    this.assertSupportedRental(lease);
  }
  private assertLeaseAccess(actor: AuthenticatedUser, lease: Lease) {
    if (actor.role === RoleName.CommunityAdmin) {
      this.assertCommunityAdmin(actor, lease.communityId);
      return;
    }
    if (
      actor.role !== RoleName.Resident ||
      lease.arrangement !== 'OWNER' ||
      lease.landlordId !== actor.id
    )
      throw new ForbiddenException('Lease management access denied');
  }
  private canManageLease(actor: AuthenticatedUser, lease: Lease) {
    try {
      this.assertLeaseAccess(actor, lease);
      return true;
    } catch {
      return false;
    }
  }
  private releaseListing(lease: Lease) {
    const listing = this.listing(lease.listingId);
    if (
      !this.leases.some(
        (l) =>
          l.id !== lease.id &&
          l.listingId === listing.id &&
          ['ACTIVE', 'PENDING_APPROVAL'].includes(l.status),
      )
    )
      listing.status = 'WITHDRAWN';
  }
  private communityForUser(user: User) {
    if (!user.apartmentId) return user.communityId;
    const apartment = this.community.getApartment(user.apartmentId);
    const floor = this.community.getFloor(apartment.floorId);
    return this.community.getTower(floor.towerId).communityId;
  }
}
