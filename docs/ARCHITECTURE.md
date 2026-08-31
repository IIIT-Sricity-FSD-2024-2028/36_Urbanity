# Architecture

## Current implementation

The frontend is static HTML/CSS/JavaScript. Active portal directories are `Authentication`, `Super Admin`, `Community Admin`, `Resident`, `Tower Representative`, and `Maintenance Worker`; the landing page is in `Landing Page`. `front-end/api.js` exposes `window.UrbanityApi` for session storage, authenticated requests, errors, and logout.

The backend is a NestJS application. Modules use controllers, DTO validation, services, guards, middleware, a response wrapper, and a global HTTP exception filter. The current data layer is repository/service-backed in-memory resources; no database adapter is confirmed in this repository.

## Domain model

`Community → Tower → Floor → Apartment`

Users are associated according to role: Community Admins are community-scoped, Tower Representatives use a tower association, and Residents use an apartment association. Workforce profiles are community-scoped. A worker may work across that community; there is no permanent worker-to-tower relationship.

## Authentication and scope

`POST /auth/login` validates a password hash and returns a JWT plus user data. `GET /auth/me` returns the authenticated backend-derived user. The JWT guard verifies the bearer token and resolves the current user from backend data; services enforce community, tower, ownership, and assignment access.

The issued token contains subject, role, and email. It is not a source of community, tower, apartment, or worker authorization; those associations are read and validated on the backend for each request.

## Complaint workflow

The status enum is:

`SUBMITTED → UNDER_REVIEW → ASSIGNED → IN_PROGRESS → RESOLVED → REVIEWED → CLOSED`

- A Resident creates a complaint; its resident hierarchy determines the location and routing authority.
- The responsible Community Admin or Tower Representative moves a submitted complaint to `UNDER_REVIEW` and assigns an eligible community worker, producing `ASSIGNED`.
- The assigned Maintenance Worker starts and resolves the work (`IN_PROGRESS`, then `RESOLVED`).
- The owning Resident submits one review, producing `REVIEWED`.
- The responsible authority closes a reviewed complaint.

Attachments are uploaded by the owning Resident and can be listed/read by authorized actors. Reviews update worker performance through the backend service.

### Transition authority and endpoints

| Change | Backend operation | Authority |
| --- | --- | --- |
| `SUBMITTED` to `UNDER_REVIEW` | `PATCH /complaints/:id/status` | Responsible Community Admin or Tower Representative |
| `UNDER_REVIEW` to `ASSIGNED` | `POST /complaints/:id/assign` | Responsible Community Admin or Tower Representative; worker must be eligible |
| `ASSIGNED` to `IN_PROGRESS` | `PATCH /complaints/:id/start` | Assigned Maintenance Worker only |
| `IN_PROGRESS` to `RESOLVED` | `PATCH /complaints/:id/resolve` | Assigned Maintenance Worker only |
| `RESOLVED` to `REVIEWED` | `POST /complaints/:id/review` | Owning Resident only; one review |
| `REVIEWED` to `CLOSED` | `PATCH /complaints/:id/status` | Responsible Community Admin or Tower Representative |

`/complaints/:id/status` supports only the two generic transitions currently defined by the service. Do not assume an actor with complaint read access may perform every lifecycle mutation.

## Operational features

The backend exposes dashboard summary and report overview endpoints to Super Admin and Community Admin. It also contains request logging, scoped complaint-route validation, Helmet/CORS configuration, RBAC, and centralized HTTP error formatting/logging.

### HTTP pipeline terminology

- **Application-level middleware:** `RequestLoggingMiddleware` is applied to all routes.
- **Router/controller-level middleware:** `ComplaintRouteContextMiddleware` runs for complaint and attachment controllers and validates complaint-route IDs.
- **Authentication:** `JwtAuthGuard` is a Nest guard, not Express middleware.
- **Authorization/RBAC:** `RolesGuard` is a Nest guard; services add resource/scope checks.
- **Error handling:** `HttpExceptionFilter` is a global Nest exception filter, not middleware.

## Business model (intended only)

Urbanity is intended as a multi-community SaaS product. Potential revenue includes community subscriptions, tiering by community/apartment size, premium analytics, additional storage, and enterprise support. No pricing or payment processing is implemented or required.

## Legacy note

`front-end/Dept Head/` remains legacy code and is outside the five-actor architecture. Do not make active features depend on it.

Some older root/backend README and mock/compatibility material describe an earlier model. They are not the active architecture contract.
