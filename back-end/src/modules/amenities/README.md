# F05 — Amenity Booking & Resource Management

This module uses the existing NestJS JWT guard, role guard, validation pipe, response wrapper, CommunityService hierarchy resolution, and CrudRepository persistence. The frontend domain feature is in `front-end/src/features/amenities/`; both owning actor routers mount it inside their existing protected PortalLayout. No legacy, database, documentation-reference, authentication, or subscription files are changed.

## API contract

All endpoints require authentication. Responses use the existing `{ success, data }` wrapper. IDs are UUIDs; bodies reject unknown properties. The Swagger-decorated DTOs define all required fields.

| Method | Path | Access / operation |
| --- | --- | --- |
| GET | `/amenities` | Resident or Community Admin; current community only |
| POST | `/amenities` | Community Admin creates in their backend-derived community |
| PATCH | `/amenities/:id` | Community Admin; complete AmenityDto configuration required |
| POST | `/amenities/:id/availability` | Resident or Community Admin; validate a requested window, attendees, and quote |
| POST | `/amenities/:id/availability/day` | Scoped date/attendee query; anonymous occupied intervals and valid start/end choices |
| POST | `/amenities/:id/bookings` | Resident; validate and reserve with expected fee/deposit |
| GET | `/amenity-bookings` | Resident sees own community bookings; Community Admin sees community bookings |
| PATCH | `/amenity-bookings/:id/approve` | Community Admin; pending requests only, with reason |
| PATCH | `/amenity-bookings/:id/reject` | Community Admin; pending requests only, with reason |
| PATCH | `/amenity-bookings/:id/cancel` | Owning Resident or Community Admin, with reason |
| POST | `/amenity-bookings/:id/change-availability` | Owner or scoped admin; date-based choices for `EDIT` or `EXTEND` |
| POST | `/amenity-bookings/:id/changes` | Owning resident; versioned, idempotent time edit or extension request |
| PATCH | `/amenity-bookings/:id/changes/:changeId/approve` | Scoped Community Admin; revalidate and approve a pending change |
| PATCH | `/amenity-bookings/:id/changes/:changeId/reject` | Scoped Community Admin; release the proposed hold, keep the original booking |
| GET | `/amenities/:id/blocks` | Same-community actors; resident output omits staff IDs/reasons |
| POST | `/amenities/:id/blocks` | Community Admin; maintenance window and reason |
| PATCH | `/amenities/:id/blocks/:blockId/release` | Community Admin; retain block and record release |

Super Admin, Tower Representative, and Maintenance Worker have no new F05 authority. Resident community and apartment are resolved through the existing apartment → floor → tower → community hierarchy. Client identity or community fields are not accepted.

## Rules

- Active amenities only; configurable IANA facility time zone, open weekdays (Sunday = 0), and one same-day opening/closing interval. Overnight operating hours are not supported.
- Requests use real ISO calendar dates/timestamps with an explicit offset; stored times are normalized to UTC. Inputs use whole minutes. The reservation UI uses dates and server-provided time choices in the facility zone; maintenance inputs and booking history use the device zone. Repeated DST times have offset labels, and nonexistent local times are never offered.
- Future start, positive duration, configured minimum/maximum duration, minimum booking notice, attendee capacity, and per-resident/per-amenity maximum active future bookings are enforced on the backend.
- Exclusive amenities allow one overlapping reservation. Shared amenities use peak simultaneous attendee occupancy. Intervals are half-open: a reservation ending at 11:00 does not conflict with one starting at 11:00.
- Pending approval holds capacity and counts toward limits. Approval rechecks availability, excluding its own hold. Approved/pending bookings can be cancelled only before starting. Completed bookings remain in history with their approval state and past timestamps.
- Changes to availability rules are rejected while upcoming active bookings exist. Names, descriptions and prices can change; bookings retain their original name and price snapshots.
- Maintenance blocks cannot overlap active reservations or another active block. Administrators must explicitly cancel reservations first. Blocks are released rather than deleted.
- All booking transitions retain actor, timestamp, status and reason. Cancellation/rejection frees capacity without deleting history.

## Flexible availability, edits, and extensions

- `bookingIntervalMinutes` defaults to **1** to preserve previously valid whole-minute bookings. Start and end align to this increment measured from the facility's opening time. The configuration must permit at least one duration between its minimum/maximum and inside its opening window.
- `turnaroundMinutes` defaults to **0**, preserving exact adjacency. Nonzero buffers reserve the original attendee capacity before/after each held interval; exclusive amenities block the entire buffered interval. Maintenance closures also enforce this gap. Two adjacent reservations require one buffer gap, not two.
- `allowExtensions` defaults to **false** (admin opt-in). An extension requires an approved, unexpired booking. Its start and attendee count stay unchanged, and its new end must increase while satisfying the **total** duration limit, increment, hours, capacity, and closure rules. Ongoing approved bookings may be extended before their original end.
- `cancellationCutoffMinutes` defaults to **0**, preserving cancellation until start. Cancellations and time edits must precede this cutoff. An edit cannot bypass the cutoff by moving the booking later. Edits retain attendee count; changing capacity requires cancelling and rebooking.
- Both pending originals and pending changes hold capacity. At most one change may await approval. A pending change reserves the union of the original/proposed intervals, counting shared occupancy once. Original dates/status/charges remain intact until approval. A rejection releases only the proposed hold.
- Extension approval must precede the original end; edit approval must precede the original change/cancellation deadline. Unreviewed requests then become `EXPIRED` on service access and release their additional hold. No background scheduler is required; every availability calculation and write applies expiry before checking conflicts.
- Day availability returns valid starts and, when a start is supplied, valid ends and durations. It returns anonymous occupied windows for that date, never other residents' IDs, apartment IDs, or review notes. The client does not download community booking history to construct availability.
- Availability checks, approvals, changes and inserts use the same synchronous validation path. Preview results are advisory; every write rechecks current state. Maintenance blocks and configuration updates also respect pending holds. Rule changes remain conservatively rejected while active future reservations exist.
- New booking requests accept an optional `clientRequestId` UUID for backward API compatibility; the new UI always sends it and must reuse it for retries. Reusing an ID with different parameters is a conflict. Changes require `clientRequestId` and `expectedVersion`; exact retries return the existing result without another history event, reservation, or charge. Old clients that omit an ID do not receive an idempotency guarantee.
- The original charge remains **flat per reservation**. Extensions use the proportional policy below; fee/deposit snapshots do not change when the facility's future prices change. Time edits cannot increase the current duration (additional time must use an extension), and do not refund shortened time.
- Per-weekday differing hours, overnight operation, recurring/date-specific opening schedules, attendee-count changes, waitlists, and payment processing remain unsupported. Existing date-specific maintenance closures are supported.
- Storage remains process-local `CrudRepository` instances (no database or schema migration). Pending changes and retry keys are also in memory. Check/write safety applies to one Node process only; restart durability and cross-process concurrency require transactional database storage.

## Concurrency and persistence boundary

The repository has in-memory storage, not a database. All availability checks and reservation/block/configuration writes are synchronous in the singleton service, with no `await` between check and insertion. Competing requests in one Node process are serialized by the event loop. The HTTP tests exercise simultaneous requests.

This does **not** provide durability across restarts or coordination across Node processes, containers, or replicas. Run only one process for this persistence model. A production database adapter must provide transactional locking or equivalent constraints covering amenities, active bookings and blocks before deployment with durable or multiple-instance storage. Do not add asynchronous work inside the current critical sections without replacing this protection.

## Fees and payment boundary

Fees and deposits are flat amounts per booking, stored separately as integer INR paise (100 paise = ₹1), with server-validated limits. Client expected amounts must equal the current configured amounts before creation. Quotes are not holds; booking always revalidates.

### Extension fee policy

For each extension: `original fee in paise × additional minutes / original duration in minutes`.
The original duration is snapshotted at reservation creation and remains immutable across edits and extensions. Additional minutes run from the current end to the proposed end. The original fee is never replaced with the total of previous fees, so later extensions do not compound. A 120-minute, ₹500 booking adds ₹250 for 60 minutes or ₹125 for 30 minutes. `amenities.pricing.ts` uses BigInt multiplication/division and rounds each extension to the nearest paise, with exact half-paise rounded up. Zero original fees produce zero extension fees.

Each valid end-time choice includes its estimated `additionalFeeMinor`. The resident sees the estimate and revised total before confirming; request versions prevent a stale interval from being accepted. The request stores the quote in `BookingChange.extensionFeeMinor` and its added minutes separately. Pending/rejected/expired requests create no payable charge. Manual approval revalidates availability and atomically appends one `extensionCharges` record keyed by change ID; automatic approvals follow the same charging path. Request retries and concurrent repeated approvals cannot add a second charge within the single-process storage model.

Original fee and refundable deposit stay in `feeMinor` and `depositMinor`. Extension charge records contain their own amount, currency, and payment status; payment history events reference their charge ID. Positive approved fees are `PENDING`, zero fees are `NOT_REQUIRED`. Booking cancellation voids unpaid extension charges and records `VOIDED` events, without claiming that a refund occurred. No additional deposit is assessed. Payment collection, paid/failed transactions, and real deposit/refund settlement remain unsupported; approval does not collect money. The existing pending-charge tracking is reused without introducing the unrelated F04 worker-payment workflow or a gateway.

There is no real payment provider in the repository. Existing subscription mock-payment endpoints are deliberately not used. F05 never marks a payment successful and has no charge/refund action. A charge is `PENDING` or `NOT_REQUIRED`; cancellation/rejection changes an unpaid pending charge to `VOIDED`, retaining charge and booking history. Approval does not imply payment. There are no collected-payment/refund records to migrate.

Real payment integration remains a separate boundary: authenticated provider callbacks, idempotent charge/refund references, reconciliation, refund policy, and an append-only transaction ledger must be implemented before accepting money. Paid cancellations must preserve original transactions and append refund events rather than reuse the unpaid void path. Amenity money must stay separate from subscriptions, dues, rent and marketplace payments.

## Frontend integration and file inventory

Created backend files: `amenities.module.ts`, `amenities.controller.ts` (amenities and booking controllers), `amenities.service.ts`, `amenities.dto.ts`, `amenities.types.ts`, this README, and `back-end/test/amenities.e2e-spec.ts`.

Created frontend files under `front-end/src/features/amenities/`:

- `pages/AmenitiesPage.jsx`: resident browsing/reservations and administrator creation/editing.
- `pages/BookingsPage.jsx`: scoped history, approval, rejection, cancellation and charge history.
- `components/AmenityForm.jsx`, `ReservationForm.jsx`, `MaintenanceBlocks.jsx`, `useAmenityMutation.js`.
- `services/amenityService.js` using the existing Axios client.
- Scoped styles: `front-end/src/styles/amenities.css`.

Modified integration files: `back-end/src/app.module.ts`, `front-end/src/constants/routes.js`, `front-end/src/constants/navigation.js`, and the Resident/Community Admin `routes.jsx` files. Existing centralized parent role guards remain intact. Shared UI components are reused without modification: Card, Button, Input, Select, Textarea, Badge, Modal, ConfirmDialog, DataTable, PageHeader, LoadingState, EmptyState, ErrorState, ToastProvider; data loading uses useAsyncResource.

## Verification

See the task report for executed results. Repeatable commands:

```sh
cd back-end
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
npx eslint src/modules/amenities/*.ts test/amenities.e2e-spec.ts
cd ../front-end
npm.cmd run build # Windows; npm run build on macOS
```

F05 HTTP coverage includes creation/editing, cross-community and ownership denial, unauthenticated/role denial, strict DTOs and fee validation, inactive amenities, operating hours/time zones, duration/capacity/advance/booking limits, simultaneous and adjacent reservations, shared-capacity peaks, approval/rejection/cancellation/history, maintenance conflicts/release, and free/automatic bookings.

No notification-delivery service or calendar integration exists to reuse; status and history are fetched in the portals, with explicit refresh on the booking list. No maintenance-worker appointments are implemented.

### Executed verification (2026-10-14)

- `npm test -- --runInBand`: 7 suites / 19 tests passed.
- `npm run test:e2e -- --runInBand amenities.e2e-spec.ts`: all 10 F05 HTTP tests passed.
- Full `npm run test:e2e -- --runInBand`: 43/44 passed. The existing `isolates complaints, routing, workers, assignments, and worker actions by community` test fails with `ECONNRESET`. It also fails alone and with AmenitiesModule excluded using a temporary Jest setup; no existing test was modified. Local HTTP tests required permission to bind ports outside the sandbox.
- Backend `npm run build`: passed.
- Targeted ESLint for all new backend TypeScript and the F05 HTTP test: passed.
- Full `tsc --noEmit -p tsconfig.json`: fails on four existing type errors in `test/app.e2e-spec.ts` (line 484 request tuple typing; lines 601 and 1317 invalid CrudService generic arguments). No F05 type errors were reported.
- Frontend `npm.cmd run build`: unavailable on macOS (`command not found`). Equivalent `npm run build`: passed; Vite reports its configuration-loader warning and a bundle over 500 kB.
- Playwright with installed Brave, using a temporary isolated API and actual login: desktop admin create/edit/approve/add-and-release maintenance block; 390px resident reserve/cancel/history; unauthorized admin navigation preserves resident session; no page errors or document horizontal overflow. Mobile invalid operating-hour request showed the backend error, re-enabled controls, and a subsequent valid availability request succeeded. Test data existed only in the temporary in-memory API, which was stopped afterward.
- `git diff --check`: passed.


### Minimum notice and reservation controls

`advanceDays` is retained as the API/config field name for compatibility, but its
meaning is **minimum notice**: a new reservation (or time edit) must start at least
X elapsed 24-hour days after submission. There is no X-day maximum future horizon.
Values are 0-365; zero permits future same-day bookings. Existing configured values
are retained as minimum notice, not reset. Existing reservations are not cancelled
or rewritten. Admin approval rechecks availability without restarting the notice
period of an already-held booking/change. Extensions preserve the original start
and use the existing extension/approval/duration/capacity rules, so they do not
require submitting the original reservation again X days beforehand.

Day availability returns `bookingWindow.minDate` and `earliestStartsAt`, plus an
optional coded `unavailableReason`. The minimum date uses the facility time zone;
exact start timestamps are validated by the server. `maxDate`/`latestStartsAt` from
the superseded maximum-horizon rule are no longer returned. `selectedStartsAt` and
`attendees` tie end-time choices to the request, preventing stale choices in the UI.

The resident form offers a date, attendee count, exact start-time input, and a
small set of suggested start times taken from actual server availability. Residents
enter a duration or choose a valid suggested duration. The end time, charges,
deposit, and total are shown before submission. Repeated DST clocks require an
explicit offset choice; durations use elapsed minutes. Extensions request extra
minutes rather than choosing from a long list of end times. Neither suggestions
nor browser controls replace server-side authorization, holds, booking quotas,
maintenance closures, interval/duration, notice, or capacity validation.
