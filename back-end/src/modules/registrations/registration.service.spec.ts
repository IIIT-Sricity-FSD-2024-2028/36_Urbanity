import { randomUUID } from 'node:crypto';
import { compareSync } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { CrudRepository } from '../../common/crud/crud.repository';
import { CrudService } from '../../common/crud/crud.service';
import { RoleName } from '../../common/enums/roles.enum';
import { User } from '../../data/schemas';
import { AuthService } from '../auth/auth.service';
import { CommunityService } from '../community/community.service';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { UserAccessService } from '../users/user-access.service';
import { ApplicationDto } from './registration.dto';
import { DEFAULT_COMMUNITY_ADMIN_PASSWORD } from './registration.constants';
import { RegistrationService } from './registration.service';

const actor = {
  id: 'super-admin',
  email: 'admin@example.test',
  role: RoleName.SuperAdmin,
};
describe('Community registration lifecycle and financial invariants', () => {
  let users: CrudService<User, Partial<User>, Partial<User>>,
    subscriptions: SubscriptionService,
    communities: CommunityService,
    service: RegistrationService;
  const details = (): ApplicationDto => ({
    requestId: randomUUID(),
    pricingVersion: 2,
    fullName: 'Representative',
    email: `${randomUUID()}@example.test`,
    communityName: 'Test Community',
    address: '100 Example Road',
    city: 'Tirupati',
    state: 'Andhra Pradesh',
    postalCode: '517001',
    country: 'India',
    towers: 2,
    floors: 6,
    apartments: 30,
    authorized: true,
  });
  const submit = () => service.submit(details());
  const initial = (a: ReturnType<typeof submit>) => {
    const view = service.evidence(a.application.id, a.secret, {
      requestId: randomUUID(),
      amountMinor: a.application.pricing.initialMinor,
      transactionReference: randomUUID(),
    });
    return service.reviewPayment(actor, view.id, view.payments[0].id, {
      decision: 'VERIFIED',
      reason: 'Bank receipt checked',
    });
  };
  const approve = (a: ReturnType<typeof submit>) => {
    initial(a);
    return service.review(actor, a.application.id, {
      decision: 'APPROVED',
      reason: 'Authority verified',
      confirmedAuthority: true,
    });
  };
  beforeEach(() => {
    users = new CrudService(new CrudRepository<User>(), 'User');
    subscriptions = new SubscriptionService(users);
    communities = new CommunityService(users, subscriptions);
    service = new RegistrationService(users, communities, subscriptions);
    service.configure(actor, {
      enabled: true,
      initialPercent: 20,
      paymentInstructions:
        'Contact platform administrator for bank transfer details.',
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('requires configured pricing and snapshots existing platform rates', () => {
    const disabled = new RegistrationService(users, communities, subscriptions);
    expect(disabled.publicPricing()).toMatchObject({
      enabled: true,
      initialPercent: 20,
      paymentMode: 'MOCK',
    });
    expect(
      disabled.submit({ ...details(), pricingVersion: 1 }).application.status,
    ).toBe('AWAITING_INITIAL_PAYMENT');
    disabled.configure(actor, {
      enabled: false,
      initialPercent: 20,
      paymentInstructions: 'Explicit administrative closure',
    });
    expect(() => disabled.submit(details())).toThrow(/configuration/);
    const a = submit();
    expect(a.application.pricing).toMatchObject({
      totalMinor: 230000,
      initialMinor: 46000,
    });
    service.configure(actor, {
      enabled: true,
      initialPercent: 50,
      paymentInstructions: 'New payment instructions for future requests',
    });
    expect(
      service.status(a.application.id, a.secret).pricing.initialMinor,
    ).toBe(46000);
    expect(() => service.submit(details())).toThrow(/Pricing changed/);
  });
  it('requires the private browser capability and never returns secrets in status', () => {
    const a = submit();
    expect(() => service.status(a.application.id)).toThrow(
      /original registration browser/,
    );
    expect(() => service.status(a.application.id, 'wrong')).toThrow();
    expect(
      JSON.stringify(service.status(a.application.id, a.secret)),
    ).not.toMatch(/sessionHash|setupHash|passwordHash|sessionExpiresAt/);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 86400000);
    expect(() => service.status(a.application.id, a.secret)).toThrow();
  });
  it('allows exact private retries and rejects duplicate email and changed submissions', () => {
    const dto = details(),
      a = service.submit(dto);
    expect(service.submit(dto, a.secret).application.id).toBe(a.application.id);
    expect(() => service.submit(dto)).toThrow(/already submitted/);
    expect(() =>
      service.submit({ ...dto, communityName: 'Changed' }, a.secret),
    ).toThrow();
    expect(() => service.submit({ ...dto, requestId: randomUUID() })).toThrow(
      /open application/,
    );
    expect(service.list(actor)).toHaveLength(1);
  });
  it('does not count evidence as paid and prevents over-reporting pending or verified funds', () => {
    const a = submit(),
      dto = {
        requestId: randomUUID(),
        amountMinor: 46000,
        transactionReference: 'BANK-001',
      };
    const view = service.evidence(a.application.id, a.secret, dto);
    expect(view.verifiedMinor).toBe(0);
    expect(view.outstandingMinor).toBe(230000);
    expect(view.payableMinor).toBe(0);
    expect(service.evidence(view.id, a.secret, dto).payments).toHaveLength(1);
    expect(() =>
      service.evidence(view.id, a.secret, {
        ...dto,
        requestId: randomUUID(),
        amountMinor: 100,
      }),
    ).toThrow(/exceeds/);
    expect(() =>
      service.review(actor, view.id, {
        decision: 'APPROVED',
        confirmedAuthority: true,
        reason: 'Looks correct',
      }),
    ).toThrow(/Verify/);
  });
  it('does not credit rejected evidence and disallows reusing transaction references', () => {
    const a = submit(),
      dto = {
        requestId: randomUUID(),
        amountMinor: 46000,
        transactionReference: 'BANK-002',
      };
    const view = service.evidence(a.application.id, a.secret, dto),
      p = view.payments[0];
    const rejected = service.reviewPayment(actor, view.id, p.id, {
      decision: 'REJECTED',
      reason: 'No receipt found',
    });
    expect(rejected.verifiedMinor).toBe(0);
    expect(rejected.payableMinor).toBe(46000);
    expect(() =>
      service.evidence(view.id, a.secret, { ...dto, requestId: randomUUID() }),
    ).toThrow(/already recorded/);
    expect(() =>
      service.reviewPayment(actor, view.id, p.id, {
        decision: 'VERIFIED',
        reason: 'Change decision',
      }),
    ).toThrow(/already final/);
  });
  it('credits partial verified payments exactly once and caps the initial stage', () => {
    const a = submit();
    for (const amountMinor of [10000, 36000]) {
      const v = service.evidence(a.application.id, a.secret, {
        requestId: randomUUID(),
        amountMinor,
        transactionReference: randomUUID(),
      });
      const p = v.payments.at(-1)!;
      service.reviewPayment(actor, v.id, p.id, {
        decision: 'VERIFIED',
        reason: 'Matched bank receipt',
      });
      service.reviewPayment(actor, v.id, p.id, {
        decision: 'VERIFIED',
        reason: 'Repeated review',
      });
    }
    const v = service.status(a.application.id, a.secret);
    expect(v.verifiedMinor).toBe(46000);
    expect(v.outstandingMinor).toBe(184000);
    expect(v.status).toBe('AWAITING_REVIEW');
    expect(() =>
      service.evidence(v.id, a.secret, {
        requestId: randomUUID(),
        amountMinor: 100,
        transactionReference: randomUUID(),
      }),
    ).toThrow();
  });
  it('requires independent authority review and restricts every admin mutation', () => {
    const a = submit();
    initial(a);
    expect(() =>
      service.review(actor, a.application.id, {
        decision: 'APPROVED',
        reason: 'Initial paid',
      }),
    ).toThrow(/authority/);
    const outsider = { ...actor, role: RoleName.CommunityAdmin };
    expect(() => service.list(outsider)).toThrow();
    expect(() =>
      service.configure(outsider, {
        enabled: true,
        initialPercent: 20,
        paymentInstructions: 'Test instructions',
      }),
    ).toThrow();
    expect(() =>
      service.review(outsider, a.application.id, {
        decision: 'REJECTED',
        reason: 'Unauthorized',
      }),
    ).toThrow();
    expect(() => service.activate(outsider, a.application.id)).toThrow();
  });
  it('approval enables access once and preserves community scope', () => {
    const a = submit(),
      v = approve(a);
    const retry = service.review(actor, v.id, {
      decision: 'APPROVED',
      reason: 'Retry approval',
      confirmedAuthority: true,
    });
    expect(retry.adminId).toBe(v.adminId);
    expect(users.findAll()).toHaveLength(1);
    const user = users.findById(v.adminId!);
    expect(user).toMatchObject({
      role: RoleName.CommunityAdmin,
      communityId: v.communityId,
      accountState: 'ACTIVE',
    });
    expect(() =>
      subscriptions.assertCommunityActive(v.communityId!),
    ).not.toThrow();
    expect(() =>
      subscriptions.completeMockPayment({
        id: user.id,
        email: user.email,
        role: user.role,
      }),
    ).toThrow(/verification/);
    const access = new UserAccessService(users, communities, subscriptions);
    expect(() =>
      access.update(actor, user.id, { password: 'bypass-password' }),
    ).toThrow(/onboarding/);
    expect(() =>
      access.update(actor, user.id, { role: RoleName.SuperAdmin }),
    ).toThrow(/onboarding/);
    expect(() => access.delete(actor, user.id)).toThrow(/onboarding records/);
    expect(() => communities.deleteCommunity(v.communityId!)).toThrow(
      /onboarding records/,
    );
    expect(service.activate(actor, v.id).status).toBe('ACTIVE');
  });
  it('rolls back failed provisioning and leaves the application reviewable', () => {
    const a = submit();
    initial(a);
    const before = communities.listCommunities().length;
    const fail = jest
      .spyOn(subscriptions, 'createPending')
      .mockImplementationOnce(() => {
        throw new Error('Provisioning failure');
      });
    expect(() =>
      service.review(actor, a.application.id, {
        decision: 'APPROVED',
        reason: 'Authority verified',
        confirmedAuthority: true,
      }),
    ).toThrow(/failure/);
    expect(users.findAll()).toHaveLength(0);
    expect(communities.listCommunities()).toHaveLength(before);
    expect(service.status(a.application.id, a.secret).decision).toBe('PENDING');
    fail.mockRestore();
    expect(
      service.review(actor, a.application.id, {
        decision: 'APPROVED',
        reason: 'Retry verified',
        confirmedAuthority: true,
      }).adminId,
    ).toBeTruthy();
  });
  it('expires, rotates and consumes legacy setup grants before enabling approved login', () => {
    const a = submit(),
      v = approve(a);
    service.applicant(v.id, a.secret).credentialSetupAt = undefined;
    service.applicant(v.id, a.secret).activatedAt = undefined;
    users.update(v.adminId!, { accountState: 'SETUP_REQUIRED' });
    const grant = service.beginSetup(v.id, a.secret);
    const second = service.beginSetup(v.id, a.secret);
    expect(() =>
      service.setup(v.id, a.secret, grant.token, 'secure-password'),
    ).toThrow();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600001);
    expect(() =>
      service.setup(v.id, a.secret, second.token, 'secure-password'),
    ).toThrow(/expired/);
    clock.mockRestore();
    const fresh = service.beginSetup(v.id, a.secret);
    service.setup(v.id, a.secret, fresh.token, 'secure-password');
    expect(
      compareSync('secure-password', users.findById(v.adminId!).passwordHash),
    ).toBe(true);
    expect(() =>
      service.setup(v.id, a.secret, fresh.token, 'another-password'),
    ).toThrow();
    expect(
      new AuthService(
        users,
        new JwtService({ secret: 'unit-test-secret' }),
      ).login({
        email: a.application.details.email,
        password: 'secure-password',
      }).user.id,
    ).toBe(v.adminId);
  });
  it('activates on approval and tracks later payments without duplicate records', () => {
    const a = submit(),
      v = approve(a);
    expect(
      compareSync(
        DEFAULT_COMMUNITY_ADMIN_PASSWORD,
        users.findById(v.adminId!).passwordHash,
      ),
    ).toBe(true);
    expect(service.activate(actor, v.id).status).toBe('ACTIVE');
    const evidence = service.evidence(v.id, a.secret, {
      requestId: randomUUID(),
      amountMinor: 184000,
      transactionReference: randomUUID(),
    });
    expect(service.activate(actor, v.id).status).toBe('ACTIVE');
    const verified = service.reviewPayment(
      actor,
      v.id,
      evidence.payments.at(-1)!.id,
      { decision: 'VERIFIED', reason: 'Full fee received' },
    );
    expect(verified.status).toBe('ACTIVE');
    expect(verified.outstandingMinor).toBe(0);
    expect(subscriptions.findByCommunityId(v.communityId!)?.paymentStatus).toBe(
      'SUCCESS',
    );
    service.activate(actor, v.id);
    service.activate(actor, v.id);
    expect(
      service
        .status(v.id, a.secret)
        .audit.filter((e) => e.action === 'ACTIVATED'),
    ).toHaveLength(1);
    expect(users.findById(v.adminId!).accountState).toBe('ACTIVE');
    expect(() =>
      subscriptions.assertCommunityActive(v.communityId!),
    ).not.toThrow();
    expect(
      new AuthService(
        users,
        new JwtService({ secret: 'unit-test-secret' }),
      ).login({
        email: a.application.details.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      }).user.id,
    ).toBe(v.adminId);
  });
  it('preserves payments on rejection without a fake refund or enabled account', () => {
    const a = submit();
    initial(a);
    const rejected = service.review(actor, a.application.id, {
      decision: 'REJECTED',
      reason: 'Authority could not be verified',
    });
    expect(rejected.reconciliationRequired).toBe(true);
    expect(rejected.verifiedMinor).toBe(46000);
    expect(users.findAll()).toHaveLength(0);
    expect(() =>
      service.review(actor, rejected.id, {
        decision: 'APPROVED',
        reason: 'Direct retry',
        confirmedAuthority: true,
      }),
    ).toThrow();
    expect(() => service.beginSetup(rejected.id, a.secret)).toThrow();
    expect(() => service.activate(actor, rejected.id)).toThrow();
  });
  it('handles 100 percent initial payment without charging a remainder', () => {
    service.configure(actor, {
      enabled: true,
      initialPercent: 100,
      paymentInstructions: 'Pay the full platform fee',
    });
    const a = service.submit({ ...details(), pricingVersion: 3 });
    initial(a);
    expect(() => service.activate(actor, a.application.id)).toThrow();
    const v = service.review(actor, a.application.id, {
      decision: 'APPROVED',
      reason: 'Authority verified',
      confirmedAuthority: true,
    });
    expect(v.outstandingMinor).toBe(0);
    expect(v.status).toBe('ACTIVE');
  });
  it('records backend-priced mock phases once and enables access on approval', () => {
    const a = submit(),
      id = a.application.id,
      requestId = randomUUID();
    expect(() =>
      service.mockPayment(id, a.secret, { requestId, phase: 'REMAINING' }),
    ).toThrow();
    const first = service.mockPayment(id, a.secret, {
      requestId,
      phase: 'INITIAL',
    });
    expect(first).toMatchObject({
      status: 'AWAITING_REVIEW',
      verifiedMinor: 46000,
      mockVerifiedMinor: 46000,
      outstandingMinor: 184000,
    });
    expect(first.payments[0]).toMatchObject({
      kind: 'MOCK',
      status: 'VERIFIED',
      amountMinor: 46000,
    });
    expect(
      service.mockPayment(id, a.secret, { requestId, phase: 'INITIAL' })
        .payments,
    ).toHaveLength(1);
    expect(
      service.mockPayment(id, a.secret, {
        requestId: randomUUID(),
        phase: 'INITIAL',
      }).payments,
    ).toHaveLength(1);
    expect(() => service.activate(actor, id)).toThrow();
    const accepted = service.acceptAndNotify(actor, id, {
      reason: 'Authority verified',
      confirmedAuthority: true,
    });
    expect(accepted.notificationStatus).toBe('SIMULATED');
    expect(accepted.status).toBe('ACTIVE');
    expect(service.activate(actor, id).status).toBe('ACTIVE');
    expect(() =>
      service.mockPayment(id, a.secret, { requestId, phase: 'REMAINING' }),
    ).toThrow(/already used/);
    const remainder = service.mockPayment(id, a.secret, {
      requestId: randomUUID(),
      phase: 'REMAINING',
    });
    expect(remainder).toMatchObject({
      verifiedMinor: 230000,
      mockVerifiedMinor: 230000,
      outstandingMinor: 0,
      status: 'ACTIVE',
    });
    expect(
      service.mockPayment(id, a.secret, {
        requestId: randomUUID(),
        phase: 'REMAINING',
      }).payments,
    ).toHaveLength(2);
    expect(remainder.credentialSetupAt).toBeTruthy();
    expect(service.activate(actor, id).status).toBe('ACTIVE');
  });
  it('coordinates acceptance and a single simulated notification across retries', () => {
    const a = submit(),
      id = a.application.id;
    service.mockPayment(id, a.secret, {
      requestId: randomUUID(),
      phase: 'INITIAL',
    });
    const dto = {
      reason: 'Authority checked independently',
      confirmedAuthority: true,
    };
    const count = communities.listCommunities().length;
    const first = service.acceptAndNotify(actor, id, dto);
    const second = service.acceptAndNotify(actor, id, dto);
    expect(first.message).toBe(
      'Application accepted and email sent successfully.',
    );
    expect(second.notifications).toHaveLength(1);
    expect(second.notifications[0]).toMatchObject({
      recipient: a.application.details.email,
      applicationReference: id,
      status: 'SIMULATED',
      actorId: actor.id,
    });
    expect(second.audit.filter((e) => e.action === 'APPROVED')).toHaveLength(1);
    expect(
      second.audit.filter((e) => e.action === 'APPROVAL_EMAIL_SIMULATED'),
    ).toHaveLength(1);
    expect(communities.listCommunities()).toHaveLength(count + 1);
    expect(users.findAll()).toHaveLength(1);
    expect(JSON.stringify(second.notifications)).not.toMatch(
      /password|token|secret/i,
    );
  });
  it('reports notification failure after approval and retries without reprovisioning', () => {
    const a = submit(),
      id = a.application.id;
    service.mockPayment(id, a.secret, {
      requestId: randomUUID(),
      phase: 'INITIAL',
    });
    const failure = jest
      .spyOn(service, 'recordApprovalNotification')
      .mockImplementationOnce(() => {
        throw new Error('Simulated event store unavailable');
      });
    const partial = service.acceptAndNotify(actor, id, {
      reason: 'Authority checked',
      confirmedAuthority: true,
    });
    expect(partial).toMatchObject({
      decision: 'APPROVED',
      notificationStatus: 'FAILED',
      notifications: [],
    });
    expect(partial.message).not.toContain('successfully');
    const adminId = partial.adminId;
    failure.mockRestore();
    const retry = service.acceptAndNotify(actor, id, {
      reason: 'Retry notification recording',
    });
    expect(retry.adminId).toBe(adminId);
    expect(retry.notifications).toHaveLength(1);
    expect(users.findAll()).toHaveLength(1);
    expect(retry.notificationStatus).toBe('SIMULATED');
  });
  it('never records a successful notification for failed or unauthorized approval', () => {
    const a = submit(),
      id = a.application.id;
    expect(() =>
      service.acceptAndNotify(actor, id, {
        reason: 'Payment not completed',
        confirmedAuthority: true,
      }),
    ).toThrow();
    expect(() =>
      service.acceptAndNotify({ ...actor, role: RoleName.CommunityAdmin }, id, {
        reason: 'Unauthorized attempt',
        confirmedAuthority: true,
      }),
    ).toThrow();
    expect(service.get(actor, id).notifications).toHaveLength(0);
    expect(users.findAll()).toHaveLength(0);
    service.review(actor, id, {
      decision: 'REJECTED',
      reason: 'Authority not verified',
    });
    expect(() =>
      service.mockPayment(id, a.secret, {
        requestId: randomUUID(),
        phase: 'INITIAL',
      }),
    ).toThrow();
    expect(() =>
      service.acceptAndNotify(actor, id, {
        reason: 'Cannot reopen rejection',
        confirmedAuthority: true,
      }),
    ).toThrow();
  });
  it('does not pay over pending evidence or misrepresent mock funds as real refunds', () => {
    const a = submit(),
      id = a.application.id;
    service.evidence(id, a.secret, {
      requestId: randomUUID(),
      amountMinor: 100,
      transactionReference: 'LEGACY-MANUAL-PENDING',
    });
    expect(() =>
      service.mockPayment(id, a.secret, {
        requestId: randomUUID(),
        phase: 'INITIAL',
      }),
    ).toThrow(/pending evidence/);
    const b = submit();
    service.mockPayment(b.application.id, b.secret, {
      requestId: randomUUID(),
      phase: 'INITIAL',
    });
    const rejected = service.review(actor, b.application.id, {
      decision: 'REJECTED',
      reason: 'Evaluation rejection',
    });
    expect(rejected.payments).toHaveLength(1);
    expect(rejected.reconciliationRequired).toBe(false);
  });
  it('sets the default once and allows only the active owner to change it from Profile', () => {
    const a = submit(),
      id = a.application.id;
    service.mockPayment(id, a.secret, {
      requestId: randomUUID(),
      phase: 'INITIAL',
    });
    const approved = service.acceptAndNotify(actor, id, {
      reason: 'Authority checked',
      confirmedAuthority: true,
    });
    const auth = new AuthService(
      users,
      new JwtService({ secret: 'unit-test-secret' }),
    );
    const user = users.findById(approved.adminId!);
    expect(
      compareSync(DEFAULT_COMMUNITY_ADMIN_PASSWORD, user.passwordHash),
    ).toBe(true);
    expect(JSON.stringify(approved)).not.toContain(
      DEFAULT_COMMUNITY_ADMIN_PASSWORD,
    );
    expect(
      auth.login({
        email: user.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      }).user.id,
    ).toBe(user.id);
    expect(() => service.beginSetup(id, a.secret)).toThrow();
    const owner = { id: user.id, email: user.email, role: user.role };
    const access = new UserAccessService(users, communities, subscriptions);
    expect(approved.status).toBe('ACTIVE');
    expect(approved.outstandingMinor).toBe(184000);
    expect(
      subscriptions.findByCommunityId(approved.communityId!)?.paymentStatus,
    ).toBe('PENDING');
    service.mockPayment(id, a.secret, {
      requestId: randomUUID(),
      phase: 'REMAINING',
    });
    service.activate(actor, id);
    expect(
      auth.login({
        email: user.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      }).user.id,
    ).toBe(user.id);
    expect(() =>
      access.update(actor, user.id, { password: 'Unwanted-admin-reset' }),
    ).toThrow();
    expect(() =>
      access.update(owner, user.id, { role: RoleName.SuperAdmin }),
    ).toThrow();
    expect(() =>
      access.update(owner, user.id, { communityId: randomUUID() }),
    ).toThrow();
    const profile = access.update(owner, user.id, {
      email: user.email,
      password: 'Changed-profile-password',
    });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(() =>
      auth.login({
        email: user.email,
        password: DEFAULT_COMMUNITY_ADMIN_PASSWORD,
      }),
    ).toThrow();
    expect(
      auth.login({ email: user.email, password: 'Changed-profile-password' })
        .user.id,
    ).toBe(user.id);
    service.acceptAndNotify(actor, id, { reason: 'Repeated approval action' });
    expect(compareSync('Changed-profile-password', user.passwordHash)).toBe(
      true,
    );
  });
});
