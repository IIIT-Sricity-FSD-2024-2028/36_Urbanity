# F02 simplified rental contract

Urbanity supports community-managed rentals and resident-owned apartments. It does
not manage new private landlord/tenant arrangements. There are no new application
roles, account-sharing features, credential transfers, gateways, or billing systems.

## Community rentals

Only a scoped Community Admin can create/change a listing or create/activate a
lease. A listing requires a vacant apartment without an individual owner,
unreconciled occupants, conflicting lease, or existing open listing. Publishing
revalidates availability. The Community Admin sets INR rent, refundable deposit,
availability, and optional details. Drafts publish to AVAILABLE, then reserve for
a single proposal. Reserved/rented terms cannot be overwritten.

Onboarding either reuses an existing same-community Resident or calls the existing
UserAccessService account creation flow. Email uniqueness, password hashing, role
validation, subscriptions, and community boundaries remain authoritative. A failed
synchronous account-and-lease operation rolls back its newly created account and
proposal. Request UUIDs deduplicate retries; mismatched retries are rejected.
Existing residents retain their identity, original account association, and ownership.

Onboarding produces an admin-approved PENDING_APPROVAL proposal. The tenant must
accept; only a Community Admin can activate it. Direct lease proposals require the
same approval/acceptance checks (admin activation records approval). Dates remain
UTC calendar dates with inclusive ends. Future ACTIVE leases grant no early access.
Expiry/approved termination removes tenancy eligibility without deleting history.
Renewals create a distinct successor requiring new activation approval.

The creating Community Admin is the existing configured rent payee; the community
remains the landlord entity. Payee snapshots on leases, obligations, and payments
are not changed by another admin reviewing a record. No fake resident represents
the community. Rent is generated only after approved activation and commencement,
once per lease/billing month. Existing full-month billing, due-day clamping,
escalations, tenant-consented amendments, evidence review, refunds, and deposit
ledgers remain. Pending evidence is never counted as verified money. Zero rent is
NOT_REQUIRED, not a fabricated payment. Rent is separate from F03/F04/F05 charges.

## Ownership and external private arrangements

Owner-occupants are created through Community Users with explicit ownership intent,
or through existing Hierarchy ownership assignment/transfer. Owners do not require
a rental lease or rent obligation. The Rentals page no longer has a prominent
Associate Existing Owner-Occupant form. Existing Hierarchy controls and the scoped
owner-assignment API remain available for authorized legacy corrections.

An external private arrangement is not recorded, approved, billed, or inferred by
Urbanity. It does not create a tenant account or change ownership/occupancy. Normal
JWT authentication continues to identify the original account holder. The app never
asks an owner to share passwords and cannot verify who uses credentials exchanged
outside it. There is no supported impersonation or credential-transfer workflow.
Do not infer private tenancy from a claim or account activity.

## Legacy private records

OWNER arrangement fields, original party IDs, payees, approval metadata, financial
entries, and ownership relationships remain for compatibility and historical reads.
No records are deleted or reset. Authorized original parties and scoped admins may
read legacy records, marked readOnly. New private listings are rejected, and private
listing review is removed. Legacy listing changes, tenant lookup/onboarding,
activation, acceptance, renewal/termination requests, amendments, payments, deposits,
and refunds are disabled. Reading history does not generate new private charges.

Previously accepted/admin-approved ACTIVE legacy leases keep their existing dated
eligibility until expiry; the change does not silently revoke a real tenant or
invent another occupant. Ambiguous/missing payee or approval data stays flagged for
manual reconciliation. Open legacy relationships may block assignment/new listings;
review and reconcile authoritative source records before migration. No new private
state is inferred for external arrangements.

## UI and APIs

One Community Admin Rentals route/sidebar entry remains. In-page section buttons:
Overview, Rental Listings, Tenants & Leases, Rent Tracking. Creation/editing and
review-before-submit tenant onboarding use existing modals. Only the selected
community lease opens its established financial/lifecycle detail tools. Deposits
remain separate. Historical private records appear in a read-only archive.
Residents retain community tenant actions and read-only private history; private
management forms and service calls have been removed.

POST /rentals/listings accepts arrangement COMMUNITY only. Listing create/update,
lease creation/activation/cancellation and tenant lookup are admin-only. Existing
service-level community scope checks remain. POST /rentals/listings/:id/review is
removed (404). Legacy private writes through shared APIs return 410 after normal
applicable authorization; tenant ownership checks and JWT/RBAC still apply.
GET inventory/managed/me endpoints, community tenant acceptance, financial evidence,
admin lease review, onboarding, and ownership-correction endpoints remain.

## F04/F05 integration and storage

CommunityService's rental occupancy policy remains the server-side source of actual
occupancy. Community tenants need accepted, approved, activated leases covering
today and the requested interval. F05 validates reservation dates and apartment;
F04 validates creation/scheduling/start. Owner-occupants remain eligible without a
lease. Unverified external private rentals cause no automatic state transition.

Existing amenity holds and unfinished paid services block handover until explicitly
resolved/cancelled under their own rules; no automatic refunds or deleted history.
Historical complaint and financial reads retain original saved relationships.
Ownership/account/hierarchy mutation guards preserve unresolved rental links.

Storage remains synchronous in-process repositories/arrays, with no database-level
transactions, multi-process locking, restart durability, migration reset, or new
persistence framework. Manual reconciliation is required for ambiguous legacy data.
Automated invitations, payment processing and rent proration remain unsupported.

Validation: backend Jest unit and API suites; scoped ESLint without --fix; backend
production build (isolated output while a watcher uses dist); frontend Vite build;
Node tests rentalForms.test.mjs and rentalView.test.mjs; git diff --check. Browser
validation must be reported separately and is not implied by those checks.
