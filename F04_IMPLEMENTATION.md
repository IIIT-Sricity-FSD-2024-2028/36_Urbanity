# F04: Paid Services Marketplace

Branch: `feat/f04-paid-services-marketplace`.

## Implemented workflow

Community Admins publish community-scoped catalogue entries, including specialization,
starting price, and active/inactive availability. The catalogue starts empty; no
production-looking sample services are inserted. Residents request a service for
their backend-derived apartment. The request snapshots the service and location.

A Community Admin in the request community or a Tower Representative in its tower
assigns an available, qualified existing Maintenance Worker. There is no provider
actor, provider account, or registration flow. Super Admin marketplace access is
not added; existing Super Admin functionality is unchanged.

The assigned worker submits an estimate. Only the requesting resident can approve,
reject, or request revisions. An estimate is the total service price, including
materials. Each revision is retained. Submitting a revision pauses chargeable work;
the latest estimate must be approved before starting, reporting progress, or
completing work. An approved increase must precede additional chargeable work.

The resident or an authorized Community Admin/Tower Representative schedules a
future appointment of at most eight hours. Explicit timezones are required by the
API; the UI converts device-local appointment input to UTC. Overlapping appointments
for either the worker or resident are rejected. Work starts inside its appointment
window; an expired unstarted appointment must be rescheduled.

Workers post progress notes and submit a completion report plus final cost. Final
cost cannot exceed the latest resident-approved estimate. An authorized Community
Admin/Tower Representative approves it or requests corrections. Correcting an old
bill does not release a worker's newer assignment.

After final-cost approval, an authority creates exactly one payment tracking record.
The backend derives its amount from the approved final cost and its payee from the
assigned worker profile/user. Clients cannot choose the amount or payee. All amounts
are integer INR paise. Paid service reviews remain separate from complaint reviews
and do not alter existing complaint performance statistics.

## Payment tracking, not payment processing

`APPROVED -> PAYMENT_REPORTED -> EVIDENCE_VERIFIED -> RECEIPT_CONFIRMED`

- Authorization transfers no money. The resident pays the worker outside Urbanity.
- The resident uploads a JPEG/PNG/WebP receipt (maximum five images, 5 MB each),
  then reports its transaction reference and evidence ID.
- Evidence is accessible only through authenticated, request-scoped retrieval.
- An authority independently checks the receipt, amount, payee, and reference, then
  records manual verification. Rejected evidence returns the payment to `APPROVED`
  for correction, retaining the rejection in activity history.
- Only the assigned intended worker payee can acknowledge receipt after verification.
- There is no gateway, automatic transfer, bank reconciliation, or automatic `PAID`
  status. `RECEIPT_CONFIRMED` denotes a worker's manual acknowledgement.
- Reporting the same external reference for multiple payment records is rejected.
  Duplicate approvals, stale request versions, and unauthorized mutations are rejected.
- Transactions are separate from subscription simulation, rent, maintenance dues,
  and community expenses.

## Backend and APIs

New module: `back-end/src/modules/paid-services/`:

- `paid-services.dto.ts`: validated request contracts and domain records.
- `paid-services.service.ts`: scoped catalogue, request workflow, estimates,
  scheduling, progress, final costs, payments, reviews, and audit history.
- `paid-services.controller.ts`: JWT/RBAC-protected API endpoints.
- `paid-service-evidence.service.ts`: validated local receipt storage/retrieval.
- `paid-services.module.ts`: module wiring.

Registered in `back-end/src/app.module.ts`. Reuses CommunityService, WorkforceService,
ComplaintsService, SubscriptionService, existing user resources, JWT/Roles guards,
validation, response wrappers, logging, and exception handling.

| Method | Path under `/paid-services` | Purpose |
| --- | --- | --- |
| GET / POST | `/catalogue` | Scoped catalogue listing / Community Admin creation |
| PATCH | `/catalogue/:id` | Community Admin update or deactivation |
| GET / POST | `/requests` | Scoped history / resident request creation |
| GET | `/requests/:id` | Scoped request details |
| GET | `/requests/:id/eligible-workers` | Authorized worker selection |
| POST | `/requests/:id/assign` | Authority assignment |
| POST | `/requests/:id/estimates` | Assigned worker estimate/revision |
| POST | `/requests/:id/estimate-decision` | Resident decision |
| POST | `/requests/:id/schedule` | Resident/authority appointment |
| POST | `/requests/:id/start` | Assigned worker start |
| POST | `/requests/:id/progress` | Assigned worker progress note |
| POST | `/requests/:id/complete` | Assigned worker completion/final bill |
| POST | `/requests/:id/final-cost-review` | Authority final-cost decision |
| POST | `/requests/:id/payment-approval` | Authority payment authorization |
| POST | `/requests/:id/evidence` | Resident multipart receipt upload |
| GET | `/requests/:id/evidence/:evidenceId` | Scoped receipt retrieval |
| POST | `/requests/:id/payment-report` | Resident external payment report |
| POST | `/requests/:id/payment-verification` | Authority evidence decision |
| POST | `/requests/:id/payment-receipt` | Worker receipt acknowledgement |
| POST | `/requests/:id/review` | Owning resident review |
| POST | `/requests/:id/cancel` | Resident/authority cancellation before work starts |

Workflow mutations require the current integer `version`; uploads validate their
current payment state and increment the version. Request creation requires a
resident-scoped UUID `clientRequestId` for safe retries. There is no generic status
or payment patch endpoint.

Necessary workforce integration adds paid-service reservations and prevents profile
changes/deactivation during reserved work. Complaints expose their existing active
assignment query so paid-service eligibility also considers complaint assignments.

## Frontend and changed files

New shared marketplace workflow under `front-end/src/features/paid-services/`:

- `pages/PaidServicesPage.jsx`
- `services/paidServicesService.js`
- `paid-services.css`

It reuses the shared API client, auth context, async resource hook, portal layouts,
navigation, forms, cards, tables, modal/confirmation dialog, status badges, rating
display, loading/empty/error states, toast feedback, and design tokens. The shared
workflow serves its four participating actors, without importing another actor's
components/services or changing shared authentication/UI foundations.

Modified `src/constants/routes.js`, `src/constants/navigation.js`, and the Resident,
Maintenance Worker, Tower Representative, and Community Admin `routes.jsx` files.
Each existing exact-role namespace retains its protection and gains `/services`.

New tests: `back-end/test/paid-services.e2e-spec.ts`.
This report is new; existing `docs/`, SQL material, designs, and legacy portals were
not modified. No new dependencies were added.

## Persistence and integration limits

The existing backend has only process-local in-memory repositories. F04 follows
that convention. Requests, catalogue, reservations, and payment tracking reset on
restart. Uploaded evidence files are local; metadata does not survive a restart.
Durable deployment needs database persistence and a receipt-file retention policy.

Checks and mutations run synchronously in one Node process. Version checks prevent
stale/concurrent updates within that process, including simultaneous payment
approval. These guarantees do not extend across multiple backend processes. A future
database adapter needs transactions, unique payment/idempotency constraints, atomic
worker reservations, and booking conflict enforcement. No unrelated persistence
infrastructure was introduced.

Existing worker availability permits one active job at a time. Assignment reserves
the worker until first completion or cancellation before start, including the time
spent waiting for estimates and appointments. Completed appointment windows remain
unavailable until their scheduled end. A calendar supporting multiple future jobs,
worker reassignment, post-start cancellation/disputes, and actual gateway integration
would be separately scoped work. Existing user deletion/relocation rules were not
redesigned by this feature.

## Validation

Executed successfully:

- `npm.cmd run build` in `back-end/`: passed.
- `npm.cmd test -- --runInBand` in `back-end/`: 7 suites, 19 tests passed.
- `npm.cmd run test:e2e -- --runInBand` in `back-end/`: 2 suites, 48 tests passed,
  including 14 F04 tests and 34 existing regression tests.
- `npm.cmd run build` in `front-end/`: passed. Vite reports configuration-format
  and bundle-size warnings; they do not fail the build.
- `node --check` for the new frontend service: passed.
- `git diff --check`: passed.

F04 tests cover catalogue authorization/validation, request ownership and retry
deduplication, inactive services, snapshot pricing, community/tower/resident/worker
isolation, specialization and availability, shared complaint/service reservations,
initial and revised estimate decisions, stale versions, work approval gates,
timezone/appointment validation, resident and worker scheduling conflicts, progress,
final-cost ceilings/corrections/review, worker payee derivation, simultaneous and
duplicate payment approvals, receipt validation/access, evidence rejection and
manual verification, worker acknowledgement, and resident reviews.

Browser validation was attempted, but no connected browser was available. Interactive
and responsive visual checks remain unverified; frontend compilation and API tests
are not a substitute for that validation.
