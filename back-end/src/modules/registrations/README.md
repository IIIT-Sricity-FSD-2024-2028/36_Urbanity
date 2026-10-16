# Registration evaluation workflow

Extends existing community provisioning, subscription pricing, users, JWT/RBAC, shared UI and API services. The landing page is unchanged by this task.

## Workflow

1. Public registration is open by default for evaluation. Total fee uses existing subscription rates (INR 1,000/tower + INR 10/apartment); the configurable initial percentage defaults to 20%, rounded up to whole INR. All amounts come from the backend and are snapshotted with the application. Super Admins can explicitly pause applications or change future pricing policy.
2. Submitting proposed community details creates an application/reference, not an active account or hierarchy.
3. **Pay Initial Amount** opens a shared confirmation dialog labelled **Mock Payment - Evaluation Only**. Confirmation records a `kind: MOCK`, `status: VERIFIED` test payment. The backend calculates the amount; no amount field is accepted from the client, no bank/card credentials are collected, and no real money moves. Initial payment makes the application eligible for review, never approved or active.
4. A Super Admin verifies representative authority and uses **Accept & Send Email**. Existing provisioning creates a Community Admin and community subscription once; approval activates their access. The application records the approving actor/time and a single `REGISTRATION_APPROVED` notification with `status: SIMULATED`. No actual email or credentials are sent. The requested evaluation success text is shown only when approval and notification recording succeed.
5. If approval fails, no successful notification is recorded. If notification recording fails after approval, the API returns the approved application with `notificationStatus: FAILED` and an accurate partial-result message. The UI updates the application and exposes **Retry Accept & Send Email**. Retry records only the missing notification; approval, community and account creation are not duplicated.
6. Approval assigns the requested default Community Admin password, completes credential provisioning, activates the community subscription and enables login immediately. No separate activation step is needed. Account records store only its bcrypt hash; it is never returned in application or simulated notification payloads. The applicant uses the existing private browser session to **Pay Remaining Amount**. The backend records only the unpaid balance as a mock payment. Remaining payment is tracked separately and does not block login. Repeated requests (even with different request IDs) cannot charge either phase twice. Old manual evidence/history remains available for compatibility; pending evidence must be resolved before making a mock payment.
7. Super Admin approval immediately enables the existing Community Admin portal. The legacy activation endpoint remains idempotent for compatibility; it requires an approved application and provisioned credentials, not full remaining payment. Subscription payment status stays pending until the recorded balance is settled.

Rejection requires a reason and retains history. Rejected applications cannot pay or activate. Mock payments never imply a real payment or refund.

## APIs added

- Public `POST /community-registrations/:id/mock-payments`: `{ requestId: UUID, phase: INITIAL | REMAINING }`, protected by the applicant's private HttpOnly cookie.
- Super Admin `POST /registration-administration/:id/accept-and-notify`: `{ reason, confirmedAuthority?: true }`. Initial approval requires authority confirmation; retry after an existing approval does not reprovision.

Existing registration, quote, status, manual evidence/review, credential setup, list/filter, rejection and activation APIs remain compatible. Public pricing identifies `paymentMode: MOCK`. Application views include mock-credit totals and simulated notification history. No new roles, public user signup, payment gateway or email infrastructure were added.

## Security and limitations

Applicant sessions use random 256-bit capabilities in HttpOnly SameSite=Strict cookies (Secure in production), with only hashes stored server-side. A reference alone grants no access. The previous one-time setup endpoints remain protected for older records that still need setup; new approvals no longer require them. Applicant sessions expire after 30 days. Secrets never appear in URLs, response JSON or logs. Use HTTPS, explicit CORS origins and frontend/API hosting on the same site. Lost browser sessions require platform support; there is no email delivery/recovery mechanism.

Records, configuration, payment history, notification events and sessions use the existing **in-memory** architecture and are lost on backend restart. Idempotency/rate limiting are single-process. Mock credits are evaluation records, not real financial accounting. The old mock subscription endpoint cannot bypass registration activation requirements.

## Verification commands

- Backend: `npm.cmd test -- --runInBand registration.service.spec.ts`
- API: `npm.cmd run test:e2e -- --runInBand registrations.e2e-spec.ts`
- UI integration: from `front-end`, `node --test test/registration.browser.mjs` (installed Edge, or set `CHROMIUM_PATH`). Uses an isolated Nest server, production-build preview and browser profile; injects one test-only notification failure to verify partial-result feedback and retry.
- Frontend helper tests: `node --test src/features/registration/registrationModel.test.mjs`
- Frontend build: `npm.cmd run build`

Production backend builds can use an isolated TypeScript output directory to avoid interrupting an existing development watcher. No files are staged or committed by these checks.
