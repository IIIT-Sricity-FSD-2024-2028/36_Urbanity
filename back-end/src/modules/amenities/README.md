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
| POST | `/amenities/:id/bookings` | Resident; validate and reserve with expected fee/deposit |
| GET | `/amenity-bookings` | Resident sees own community bookings; Community Admin sees community bookings |
| PATCH | `/amenity-bookings/:id/approve` | Community Admin; pending requests only, with reason |
| PATCH | `/amenity-bookings/:id/reject` | Community Admin; pending requests only, with reason |
| PATCH | `/amenity-bookings/:id/cancel` | Owning Resident or Community Admin, with reason |
| GET | `/amenities/:id/blocks` | Same-community actors; resident output omits staff IDs/reasons |
| POST | `/amenities/:id/blocks` | Community Admin; maintenance window and reason |
| PATCH | `/amenities/:id/blocks/:blockId/release` | Community Admin; retain block and record release |

Super Admin, Tower Representative, and Maintenance Worker have no new F05 authority. Resident community and apartment are resolved through the existing apartment → floor → tower → community hierarchy. Client identity or community fields are not accepted.

## Rules

- Active amenities only; configurable IANA facility time zone, open weekdays (Sunday = 0), and one same-day opening/closing interval. Overnight operating hours are not supported.
- Requests use ISO timestamps with an explicit offset; stored times are normalized to UTC. Inputs use whole minutes. UI reservation and maintenance inputs use the device time zone; facility operating hours show their configured zone.
- Future start, positive duration, configured minimum/maximum duration, rolling advance window, attendee capacity, and per-resident/per-amenity maximum active future bookings are enforced on the backend.
- Exclusive amenities allow one overlapping reservation. Shared amenities use peak simultaneous attendee occupancy. Intervals are half-open: a reservation ending at 11:00 does not conflict with one starting at 11:00.
- Pending approval holds capacity and counts toward limits. Approval rechecks availability, excluding its own hold. Approved/pending bookings can be cancelled only before starting. Completed bookings remain in history with their approval state and past timestamps.
- Changes to availability rules are rejected while upcoming active bookings exist. Names, descriptions and prices can change; bookings retain their original name and price snapshots.
- Maintenance blocks cannot overlap active reservations or another active block. Administrators must explicitly cancel reservations first. Blocks are released rather than deleted.
- All booking transitions retain actor, timestamp, status and reason. Cancellation/rejection frees capacity without deleting history.

## Concurrency and persistence boundary

The repository has in-memory storage, not a database. All availability checks and reservation/block/configuration writes are synchronous in the singleton service, with no `await` between check and insertion. Competing requests in one Node process are serialized by the event loop. The HTTP tests exercise simultaneous requests.

This does **not** provide durability across restarts or coordination across Node processes, containers, or replicas. Run only one process for this persistence model. A production database adapter must provide transactional locking or equivalent constraints covering amenities, active bookings and blocks before deployment with durable or multiple-instance storage. Do not add asynchronous work inside the current critical sections without replacing this protection.

## Fees and payment boundary

Fees and deposits are flat amounts per booking, stored separately as integer INR paise (100 paise = ₹1), with server-validated limits. Client expected amounts must equal the current configured amounts before creation. Quotes are not holds; booking always revalidates.

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
