import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { hashSync } from 'bcryptjs';
import { DEFAULT_COMMUNITY_ADMIN_PASSWORD } from './registration.constants';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { serviceToken } from '../../data/urbanity.resources';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { CommunityService } from '../community/community.service';
import {
  APARTMENT_RATE,
  SubscriptionService,
  TOWER_RATE,
} from '../subscriptions/subscription.service';
import {
  ApplicationDto,
  EvidenceDto,
  PaymentReviewDto,
  PricingDto,
  ReviewDto,
  SizeDto,
  MockPaymentDto,
  AcceptanceDto,
} from './registration.dto';

type Payment = EvidenceDto & {
  kind?: 'MANUAL' | 'MOCK';
  id: string;
  phase: 'INITIAL' | 'REMAINING';
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  reason?: string;
};
type Audit = { action: string; at: string; actorId?: string; reason?: string };
type Quote = {
  version: number;
  currency: 'INR';
  totalMinor: number;
  initialMinor: number;
  towerRate: number;
  apartmentRate: number;
  initialPercent: number;
  paymentInstructions: string;
};
type Application = {
  id: string;
  details: ApplicationDto;
  pricing: Quote;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  payments: Payment[];
  audit: Audit[];
  notifications: Array<{
    id: string;
    recipient: string;
    subject: string;
    type: 'REGISTRATION_APPROVED';
    applicationReference: string;
    createdAt: string;
    actorId: string;
    status: 'SIMULATED';
  }>;
  communityId?: string;
  adminId?: string;
  credentialSetupAt?: string;
  activatedAt?: string;
  sessionHash: string;
  sessionExpiresAt: number;
  setupHash?: string;
  setupExpiresAt?: number;
};
const now = () => new Date().toISOString();
const digest = (secret: string) =>
  createHash('sha256').update(secret).digest('hex');
const matches = (secret: string | undefined, hash: string | undefined) =>
  !!secret &&
  !!hash &&
  timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(hash));

@Injectable()
export class RegistrationService {
  private readonly applications = new Map<string, Application>();
  private pricing = {
    enabled: true,
    initialPercent: 20,
    paymentInstructions:
      'Mock Payment - Evaluation Only. No real money is transferred.',
    version: 1,
  };

  constructor(
    @Inject(serviceToken('users'))
    private readonly users: CrudService<User, Partial<User>, Partial<User>>,
    private readonly communities: CommunityService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  applicationIdForRequest(requestId: string) {
    return [...this.applications.values()].find(
      (a) => a.details.requestId === requestId,
    )?.id;
  }
  publicPricing() {
    return {
      ...this.pricing,
      towerRate: TOWER_RATE,
      apartmentRate: APARTMENT_RATE,
      currency: 'INR',
      paymentMode: 'MOCK' as const,
    };
  }
  configure(actor: AuthenticatedUser, dto: PricingDto) {
    this.requireAdmin(actor);
    this.pricing = { ...dto, version: this.pricing.version + 1 };
    return this.publicPricing();
  }
  quote(dto: SizeDto): Quote {
    if (!this.pricing.enabled)
      throw new ServiceUnavailableException(
        'Community registration is awaiting platform payment configuration. Please try again later.',
      );
    if (
      !Number.isInteger(dto.towers) ||
      !Number.isInteger(dto.apartments) ||
      dto.towers < 1 ||
      dto.towers > 10000 ||
      dto.apartments < dto.towers ||
      dto.apartments > 1000000
    )
      throw new BadRequestException(
        'Provide valid proposed tower and apartment counts',
      );
    const total = dto.towers * TOWER_RATE + dto.apartments * APARTMENT_RATE;
    return {
      version: this.pricing.version,
      currency: 'INR',
      totalMinor: total * 100,
      initialMinor:
        Math.ceil((total * this.pricing.initialPercent) / 100) * 100,
      towerRate: TOWER_RATE,
      apartmentRate: APARTMENT_RATE,
      initialPercent: this.pricing.initialPercent,
      paymentInstructions: this.pricing.paymentInstructions,
    };
  }
  submit(dto: ApplicationDto, existingSession?: string) {
    const retry = [...this.applications.values()].find(
      (a) => a.details.requestId === dto.requestId,
    );
    if (retry) {
      if (
        JSON.stringify(retry.details) !== JSON.stringify(dto) ||
        !matches(existingSession, retry.sessionHash)
      )
        throw new ConflictException(
          'Application already submitted. Return to your original confirmation page.',
        );
      return { application: this.view(retry) };
    }
    const pricing = this.quote(dto);
    if (pricing.version !== dto.pricingVersion)
      throw new ConflictException(
        'Pricing changed. Review a fresh quote before submitting.',
      );
    if (dto.floors < dto.towers || dto.apartments < dto.floors)
      throw new BadRequestException(
        'Total proposed floors must cover towers, and apartments must cover floors',
      );
    if (
      `${dto.address}, ${dto.city}, ${dto.state}, ${dto.postalCode}, ${dto.country}`
        .length > 250
    )
      throw new BadRequestException(
        'The combined community address must be at most 250 characters',
      );
    const email = dto.email.toLowerCase();
    if (
      this.users.findAll().some((u) => u.email.toLowerCase() === email) ||
      [...this.applications.values()].some(
        (a) =>
          a.details.email.toLowerCase() === email && a.decision !== 'REJECTED',
      )
    )
      throw new ConflictException(
        'This email is already associated with an account or an open application. Contact the platform administrator.',
      );
    if (this.applications.size >= 5000)
      throw new ServiceUnavailableException(
        'Registration capacity reached. Contact the platform administrator.',
      );
    const secret = randomBytes(32).toString('base64url');
    const a: Application = {
      id: randomUUID(),
      details: dto,
      pricing,
      decision: 'PENDING',
      createdAt: now(),
      payments: [],
      notifications: [],
      audit: [{ action: 'SUBMITTED', at: now() }],
      sessionHash: digest(secret),
      sessionExpiresAt: Date.now() + 30 * 86400000,
    };
    this.applications.set(a.id, a);
    return { application: this.view(a), secret };
  }
  applicant(id: string, secret?: string) {
    const a = this.applications.get(id);
    if (
      !a ||
      !matches(secret, a.sessionHash) ||
      a.sessionExpiresAt <= Date.now()
    )
      throw new UnauthorizedException(
        'Return using the original registration browser. If the session has expired, contact the platform administrator with your reference.',
      );
    return a;
  }
  status(id: string, secret?: string) {
    return this.view(this.applicant(id, secret));
  }
  mockPayment(id: string, secret: string | undefined, dto: MockPaymentDto) {
    const a = this.applicant(id, secret);
    if (a.decision === 'REJECTED')
      throw new ConflictException('Rejected applications cannot make payments');
    const request = a.payments.find((p) => p.requestId === dto.requestId);
    if (request && (request.kind !== 'MOCK' || request.phase !== dto.phase))
      throw new ConflictException(
        'Payment request was already used for another operation',
      );
    // Each phase has a stable server-side identity, even if a retry has a new request ID.
    if (a.payments.some((p) => p.kind === 'MOCK' && p.phase === dto.phase))
      return this.view(a);
    if (
      (dto.phase === 'INITIAL' && a.decision !== 'PENDING') ||
      (dto.phase === 'REMAINING' && a.decision !== 'APPROVED')
    )
      throw new ForbiddenException(
        'Payment phase does not match application approval status',
      );
    if (a.payments.some((p) => p.status === 'PENDING_VERIFICATION'))
      throw new ConflictException(
        'Resolve existing pending evidence before making a mock payment',
      );
    const amountMinor =
      (dto.phase === 'INITIAL'
        ? a.pricing.initialMinor
        : a.pricing.totalMinor) - this.paid(a);
    if (amountMinor <= 0) return this.view(a);
    a.payments.push({
      id: randomUUID(),
      requestId: dto.requestId,
      kind: 'MOCK',
      phase: dto.phase,
      amountMinor,
      transactionReference: `MOCK-${a.id}-${dto.phase}`,
      status: 'VERIFIED',
      createdAt: now(),
      reviewedAt: now(),
      reason: 'Mock Payment - Evaluation Only. No real money was transferred.',
    });
    this.syncSubscriptionPayment(a);
    this.audit(
      a,
      'MOCK_PAYMENT_RECORDED',
      undefined,
      `${dto.phase}: ${amountMinor} paise (evaluation only)`,
    );
    return this.view(a);
  }
  acceptAndNotify(actor: AuthenticatedUser, id: string, dto: AcceptanceDto) {
    this.review(actor, id, { ...dto, decision: 'APPROVED' });
    try {
      this.recordApprovalNotification(actor, id);
      return {
        ...this.view(this.find(id)),
        notificationStatus: 'SIMULATED' as const,
        message: 'Application accepted and email sent successfully.',
      };
    } catch {
      return {
        ...this.view(this.find(id)),
        notificationStatus: 'FAILED' as const,
        message:
          'Application accepted, but the simulated email could not be recorded. Retry Accept & Send Email.',
      };
    }
  }
  // Records an evaluation event only; no delivery service or credentials are involved.
  recordApprovalNotification(actor: AuthenticatedUser, id: string) {
    this.requireAdmin(actor);
    const a = this.find(id);
    if (a.decision !== 'APPROVED')
      throw new ConflictException(
        'Approval is required before recording the simulated email',
      );
    const existing = a.notifications.find(
      (n) => n.type === 'REGISTRATION_APPROVED',
    );
    if (existing) return existing;
    const notification = {
      id: randomUUID(),
      recipient: a.details.email,
      subject: 'Urbanity community registration approved',
      type: 'REGISTRATION_APPROVED' as const,
      applicationReference: id,
      createdAt: now(),
      actorId: actor.id,
      status: 'SIMULATED' as const,
    };
    a.notifications.push(notification);
    this.audit(a, 'APPROVAL_EMAIL_SIMULATED', actor.id);
    return notification;
  }
  list(actor: AuthenticatedUser) {
    this.requireAdmin(actor);
    return [...this.applications.values()].map((a) => this.view(a));
  }
  get(actor: AuthenticatedUser, id: string) {
    this.requireAdmin(actor);
    return this.view(this.find(id));
  }

  evidence(id: string, secret: string | undefined, dto: EvidenceDto) {
    const a = this.applicant(id, secret);
    const retry = a.payments.find((p) => p.requestId === dto.requestId);
    if (retry) {
      if (
        retry.amountMinor !== dto.amountMinor ||
        retry.transactionReference !== dto.transactionReference
      )
        throw new ConflictException(
          'Payment retry does not match the original evidence',
        );
      return this.view(a);
    }
    if (a.decision === 'REJECTED')
      throw new ConflictException('Application no longer accepts payments');
    if (
      !Number.isSafeInteger(dto.amountMinor) ||
      dto.amountMinor <= 0 ||
      dto.amountMinor % 100
    )
      throw new BadRequestException('Use a positive whole INR payment amount');
    const phase = a.decision === 'APPROVED' ? 'REMAINING' : 'INITIAL';
    const committed = a.payments
      .filter((p) => p.status !== 'REJECTED')
      .reduce((n, p) => n + p.amountMinor, 0);
    const limit =
      phase === 'INITIAL' ? a.pricing.initialMinor : a.pricing.totalMinor;
    if (committed + dto.amountMinor > limit)
      throw new BadRequestException(
        'Payment exceeds the amount currently due, including evidence awaiting verification',
      );
    if (
      [...this.applications.values()].some((item) =>
        item.payments.some(
          (p) =>
            p.transactionReference.toLowerCase() ===
            dto.transactionReference.toLowerCase(),
        ),
      )
    )
      throw new ConflictException('Transaction reference already recorded');
    a.payments.push({
      ...dto,
      id: randomUUID(),
      phase,
      status: 'PENDING_VERIFICATION',
      createdAt: now(),
    });
    this.audit(a, 'PAYMENT_EVIDENCE_SUBMITTED');
    return this.view(a);
  }
  reviewPayment(
    actor: AuthenticatedUser,
    id: string,
    paymentId: string,
    dto: PaymentReviewDto,
  ) {
    this.requireAdmin(actor);
    const a = this.find(id),
      p = a.payments.find((p) => p.id === paymentId);
    if (!p) throw new NotFoundException('Payment evidence not found');
    if (p.status === dto.decision) return this.view(a);
    if (p.status !== 'PENDING_VERIFICATION' || a.decision === 'REJECTED')
      throw new ConflictException(
        'Payment review is already final or application is rejected',
      );
    if (
      dto.decision === 'VERIFIED' &&
      this.paid(a) + p.amountMinor > a.pricing.totalMinor
    )
      throw new ConflictException('Verification would exceed the agreed fee');
    Object.assign(p, {
      status: dto.decision,
      reason: dto.reason,
      reviewerId: actor.id,
      reviewedAt: now(),
    });
    this.syncSubscriptionPayment(a);
    this.audit(a, `PAYMENT_${dto.decision}`, actor.id, dto.reason);
    return this.view(a);
  }
  review(actor: AuthenticatedUser, id: string, dto: ReviewDto) {
    this.requireAdmin(actor);
    const a = this.find(id);
    if (a.decision === dto.decision)
      return dto.decision === 'APPROVED'
        ? this.activate(actor, id)
        : this.view(a);
    if (a.decision !== 'PENDING')
      throw new ConflictException('Application review is already final');
    if (dto.decision === 'APPROVED') {
      if (
        !dto.confirmedAuthority ||
        this.paid(a) < a.pricing.initialMinor ||
        a.payments.some((p) => p.status === 'PENDING_VERIFICATION')
      )
        throw new BadRequestException(
          'Verify the initial payment and applicant authority before approval',
        );
      const d = a.details;
      // Existing atomic community provisioning rolls back all three records on failure.
      const provisioned = this.communities.createCommunity(
        {
          name: d.communityName,
          address: `${d.address}, ${d.city}, ${d.state}, ${d.postalCode}, ${d.country}`,
          description: d.description,
          adminName: d.fullName,
          adminEmail: d.email,
          adminPassword: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
          contractedTowers: d.towers,
          contractedApartments: d.apartments,
        },
        a.id,
        true,
      );
      a.communityId = provisioned.community.id;
      a.adminId = provisioned.admin.id;
      if (d.phone) this.users.update(a.adminId, { phone: d.phone });
      a.credentialSetupAt = now();
      this.audit(a, 'DEFAULT_CREDENTIALS_PROVISIONED', actor.id);
    }
    a.decision = dto.decision;
    this.audit(a, dto.decision, actor.id, dto.reason);
    return dto.decision === 'APPROVED'
      ? this.activate(actor, id)
      : this.view(a);
  }
  beginSetup(id: string, secret?: string) {
    const a = this.applicant(id, secret);
    if (a.decision !== 'APPROVED' || a.credentialSetupAt)
      throw new ConflictException(
        'Credential setup is unavailable or already complete',
      );
    const token = randomBytes(32).toString('base64url');
    a.setupHash = digest(token);
    a.setupExpiresAt = Date.now() + 3600000;
    return { token, expiresAt: new Date(a.setupExpiresAt).toISOString() };
  }
  setup(
    id: string,
    secret: string | undefined,
    setupToken: string | undefined,
    password: string,
  ) {
    const a = this.applicant(id, secret);
    if (
      a.decision !== 'APPROVED' ||
      a.credentialSetupAt ||
      !a.adminId ||
      !matches(setupToken, a.setupHash) ||
      (a.setupExpiresAt ?? 0) <= Date.now()
    )
      throw new UnauthorizedException(
        'Credential setup has expired or was already used. Start setup again.',
      );
    this.users.update(a.adminId, {
      passwordHash: hashSync(password, 10),
      accountState: 'AWAITING_ACTIVATION',
    });
    a.setupHash = undefined;
    a.setupExpiresAt = undefined;
    a.credentialSetupAt = now();
    this.audit(a, 'CREDENTIAL_SETUP_COMPLETED');
    return this.activateApproved(a);
  }
  activate(actor: AuthenticatedUser, id: string) {
    this.requireAdmin(actor);
    return this.activateApproved(this.find(id), actor.id);
  }
  private activateApproved(a: Application, actorId?: string) {
    const id = a.id;
    if (a.activatedAt) return this.view(a);
    if (
      a.decision !== 'APPROVED' ||
      !a.credentialSetupAt ||
      !a.adminId ||
      !a.communityId
    )
      throw new ForbiddenException(
        'Super Admin approval and provisioned credentials are required',
      );
    const user = this.users.findById(a.adminId);
    if (
      user.registrationApplicationId !== id ||
      user.communityId !== a.communityId ||
      user.role !== RoleName.CommunityAdmin
    )
      throw new ConflictException(
        'Provisioned account does not match this registration',
      );
    this.subscriptions.activateRegistration(
      a.communityId,
      a.id,
      this.paid(a) === a.pricing.totalMinor,
    );
    this.users.update(user.id, { accountState: 'ACTIVE' });
    a.activatedAt = now();
    this.audit(a, 'ACTIVATED', actorId);
    return this.view(a);
  }
  private view(a: Application) {
    const verifiedMinor = this.paid(a),
      outstandingMinor = a.pricing.totalMinor - verifiedMinor;
    const initialVerifiedMinor = a.payments
      .filter((p) => p.phase === 'INITIAL' && p.status === 'VERIFIED')
      .reduce((n, p) => n + p.amountMinor, 0);
    const pendingMinor = a.payments
      .filter((p) => p.status === 'PENDING_VERIFICATION')
      .reduce((n, p) => n + p.amountMinor, 0);
    const status = a.activatedAt
      ? 'ACTIVE'
      : a.decision === 'REJECTED'
        ? 'REJECTED'
        : a.decision === 'PENDING'
          ? verifiedMinor >= a.pricing.initialMinor
            ? 'AWAITING_REVIEW'
            : pendingMinor
              ? 'PAYMENT_UNDER_REVIEW'
              : 'AWAITING_INITIAL_PAYMENT'
          : outstandingMinor
            ? 'AWAITING_REMAINING_PAYMENT'
            : !a.credentialSetupAt
              ? 'AWAITING_ACCOUNT_SETUP'
              : 'READY_FOR_ACTIVATION';
    const { requestId: _requestId, ...details } = a.details;
    void _requestId;
    return {
      id: a.id,
      details,
      pricing: { ...a.pricing },
      decision: a.decision,
      status,
      createdAt: a.createdAt,
      payments: a.payments.map(({ requestId: _requestId, ...p }) => {
        void _requestId;
        return { ...p };
      }),
      audit: a.audit.map((e) => ({ ...e })),
      notifications: a.notifications.map((n) => ({ ...n })),
      mockVerifiedMinor: a.payments
        .filter((p) => p.kind === 'MOCK' && p.status === 'VERIFIED')
        .reduce((n, p) => n + p.amountMinor, 0),
      communityId: a.communityId,
      adminId: a.adminId,
      credentialSetupAt: a.credentialSetupAt,
      activatedAt: a.activatedAt,
      verifiedMinor,
      initialVerifiedMinor,
      outstandingMinor,
      pendingMinor,
      payableMinor: Math.max(
        0,
        (a.decision === 'PENDING'
          ? a.pricing.initialMinor
          : a.pricing.totalMinor) -
          verifiedMinor -
          pendingMinor,
      ),
      reconciliationRequired:
        a.decision === 'REJECTED' &&
        a.payments.some((p) => p.kind !== 'MOCK' && p.status !== 'REJECTED'),
    };
  }
  private syncSubscriptionPayment(a: Application) {
    if (a.activatedAt && a.communityId)
      this.subscriptions.activateRegistration(
        a.communityId,
        a.id,
        this.paid(a) === a.pricing.totalMinor,
      );
  }
  private paid(a: Application) {
    return a.payments
      .filter((p) => p.status === 'VERIFIED')
      .reduce((n, p) => n + p.amountMinor, 0);
  }
  private find(id: string) {
    const a = this.applications.get(id);
    if (!a) throw new NotFoundException('Registration not found');
    return a;
  }
  private audit(
    a: Application,
    action: string,
    actorId?: string,
    reason?: string,
  ) {
    a.audit.push({ action, at: now(), actorId, reason });
  }
  private requireAdmin(actor: AuthenticatedUser) {
    if (actor.role !== RoleName.SuperAdmin)
      throw new ForbiddenException(
        'Only Super Admins manage community registrations',
      );
  }
}
