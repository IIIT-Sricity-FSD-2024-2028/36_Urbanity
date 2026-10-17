# Urbanity - Multi-Community Apartment Operations Platform

## Run a fresh clone or submission ZIP (Windows PowerShell)

Prerequisites: Node.js **22.12 or newer** (Node 22 LTS recommended), npm 10 or
newer, and internet access for the first dependency installation. Verify with
`node --version` and `npm.cmd --version`. No database or external services are
required. Use the two directories from the same checkout.

In terminal 1, from the repository root:

```powershell
cd back-end
npm.cmd ci
npm.cmd run start:dev
```

In terminal 2, from the repository root:

```powershell
cd front-end
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:5173/login**. The API is **http://localhost:3000** and
Swagger is **http://localhost:3000/api/docs**. Wait for Nest to report successful
startup before signing in. Stop each server with Ctrl+C.

Development login: **superadmin@urbanity.local** / **superadmin-dev**, leading
to `/super-admin`. The backend seeds this account and the other development
roles into in-memory repositories on every startup and verifies passwords with
bcrypt. Data changes and uploaded-file metadata reset when the backend restarts;
this submission is a development demo, not persistent production storage.

### Optional environment configuration

No `.env` files are needed for the defaults. If you need custom values, copy the
tracked templates from the repository root, then edit those local files:

```powershell
Copy-Item back-end/.env.example back-end/.env
Copy-Item front-end/.env.example front-end/.env
```

Backend startup loads `back-end/.env`; existing shell environment values take
precedence. `PORT` defaults to 3000, `CORS_ORIGIN` is a comma-separated origin
allowlist, and `JWT_EXPIRES_IN` defaults to `1h`. Development has a built-in JWT
secret; production requires a unique `JWT_SECRET`. The seeded public demo
accounts and in-memory storage are unsuitable for production deployment.

The frontend defaults to `VITE_API_URL=/api`. Vite proxies `/api/auth/login` to
`http://localhost:3000/auth/login`, stripping only the proxy prefix. Nest has
**no global API prefix**; `/api/docs` is the documentation path only. To change
the backend port, set backend `PORT` and frontend `API_PROXY_TARGET` to matching
values. Alternatively set `VITE_API_URL=http://localhost:3000` (without `/api`)
for direct requests, and allow the frontend origin in backend `CORS_ORIGIN`.
`VITE_*` values are public and included at build time; never put secrets there.
Restart servers after changing configuration, and rebuild after changing
frontend build-time values.

### Verification and troubleshooting

```powershell
cd back-end
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
cd ../front-end
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd run preview
```

The optional browser integration test requires Microsoft Edge (or `CHROMIUM_PATH`
pointing to Chromium). It starts isolated servers and a disposable browser profile.

Preview is at http://localhost:4173 and uses the same API proxy; keep the backend
running. Deployed static hosting must provide an equivalent `/api` reverse proxy
or build with an explicit backend origin and configure its CORS allowlist.

- **404 at sign-in:** inspect the browser Network tab. With defaults, the request
  must be `POST http://localhost:5173/api/auth/login`; Nest receives
  `POST /auth/login`. A stale `VITE_API_URL` or a frontend from another checkout
  can cause a mismatch. Missing/blank frontend configuration uses `/api`.
- **Cannot connect / proxy error:** start the backend, check its terminal output
  and http://localhost:3000/api/docs, and confirm `API_PROXY_TARGET` matches its
  port. A 401 means invalid credentials, not a connectivity error.
- **Port in use:** Vite fails clearly instead of choosing another port. Stop the
  conflicting process, or use `npm.cmd run dev -- --port 5174` and add
  `http://localhost:5174` to backend `CORS_ORIGIN` if using direct API requests.
  Change backend `PORT` and proxy target together if port 3000 is occupied.
- **Unexpected environment:** remove stale local `.env` overrides or correct
  shell variables (`PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `VITE_API_URL`,
  `API_PROXY_TARGET`). Restart both processes. An invalid `PORT` fails at startup.
- **Installation:** use `npm.cmd ci` with the included lockfiles, including dev
  dependencies; do not copy `node_modules` between computers. Do not use
  `npm audit fix --force`; audit findings are separate from routing/authentication.

Create a source-only submission from a tested commit:

```powershell
git archive --format=zip --prefix=Urbanity/ --output=Urbanity-submission.zip HEAD
```

Extract it, open PowerShell in `Urbanity`, and repeat the two-terminal workflow.
The ZIP contains tracked templates and lockfiles; local `.env`, dependencies,
logs, uploads, and build output are not required.

---

## Problem Statement

Apartment communities often manage maintenance issues through calls, chat messages, and disconnected records. This makes it difficult to identify the exact complaint location, route the issue to the responsible authority, assign an eligible maintenance worker, and verify that the work was completed correctly.

Additionally, community administration involves managing residents, apartments, rental arrangements, amenity reservations, paid services, and financial records. Without a centralized platform, these activities can become difficult to coordinate, track, and manage securely.

This project aims to build a **multi-community apartment operations platform** that centralizes community registration, apartment management, maintenance operations, rental management, amenity booking, and resident services. It provides role-based access, structured workflows, and transparent tracking for community administrators, residents, and maintenance workers.

---

## Identified Actors

1. **Super Admin**
2. **Community Admin**
3. **Tower Representative**
4. **Resident**
5. **Maintenance Worker**

---

## Planned Features (Actor-wise)

### Super Admin

- Manage communities and platform-level users
- Review community registration applications and approve or reject requests
- Review applicant and community details before approval
- Track community registration fees and mock payment records
- Use the Accept & Send Email action to simulate approval email notifications
- Monitor cross-community complaints, workforce, dashboards, and reports
- Maintain platform-wide visibility and administration
- Manage Community Admin accounts and platform operations

---

### Community Admin

- Manage the Community -> Tower -> Floor -> Apartment hierarchy
- Create and manage Residents, Tower Representatives, and Maintenance Workers
- Manage community registration activation and community configuration
- Create and manage community rental listings, tenants, and leases
- Track community-managed rental obligations and payment statuses
- Configure amenities, reservation rules, booking fees, and refundable deposits
- Manage paid services available to residents
- Review and assign community-level complaints to eligible workers
- Verify proof of work for community complaints
- Manage workforce availability and monitor worker performance
- Monitor community dashboards, resident feedback, and operational activity

---

### Tower Representative

- View complaints routed to the assigned tower
- Review Apartment and Tower complaints before assignment
- Assign eligible and available Maintenance Workers
- Verify submitted proof of work and rate worker quality
- Manage and review maintenance appointments where supported
- View tower residents, complaint activity, and worker performance

---

### Resident

- Access the apartment community associated with their account
- Raise Apartment, Tower, or Community complaints
- Upload supporting images for better issue clarity
- Track the progress of submitted complaints
- Receive resolution updates after authority verification
- Rate completed work on speed, quality, and communication
- Provide optional written feedback after issue resolution
- View available community rental listings and relevant lease information
- View rent obligations and payment statuses where applicable
- Browse paid services and request eligible services
- Book available amenities and facilities
- View reservation details, booking charges, and refundable deposits where applicable
- Track relevant service requests and booking statuses

---

### Maintenance Worker

- View authorized assigned maintenance tasks
- Access complaint type, exact location, issue details, and required specialization
- Start assigned work and update work progress
- Submit proof of work with resolution notes and supporting images
- Provide work estimates for assigned paid-service requests where supported
- Update service progress and completion details
- Track assigned, in-progress, and completed work

---

## Project Goals

- Improve transparency in apartment maintenance management
- Reduce issue-resolution time through clear routing and assignment
- Enable accountability at every stage of the complaint lifecycle
- Simplify community registration and onboarding
- Centralize apartment ownership, rental listings, leases, and rent tracking
- Simplify amenity reservations and community resource management
- Support paid resident services with structured requests and status tracking
- Improve resident satisfaction through verified resolutions and feedback
- Maintain secure community, tower, resident, and worker scope boundaries
- Track registration payments and financial obligations accurately
- Provide data-driven insights into complaint activity and worker performance

---

## Tech Stack (Planned)

- **Frontend:** React, Vite, HTML, CSS, and JavaScript
- **Backend:** Node.js, NestJS, and TypeScript
- **Data:** In-memory development repositories; persistent storage is planned
- **API Documentation:** Swagger / OpenAPI
- **Authentication:** JWT-based role-based access control (RBAC)
- **Validation and Security:** class-validator, bcrypt password hashing, Helmet, CORS, guards, and backend ownership checks
- **Testing:** Jest and Supertest

---

## Run locally

Open two PowerShell terminals from the project directory.

Start the backend:

```powershell
cd back-end
npm.cmd install
npm.cmd run start:dev
````

The API runs at `http://localhost:3000`.

Start the frontend in the second terminal:

```powershell
cd front-end
npm.cmd install
npm.cmd run dev
```

Open the frontend URL displayed by Vite in the terminal.

Development Super Admin credentials:

```text
Email: superadmin@urbanity.local
Password: superadmin-dev
```

---

## Future Enhancements

* Persistent database storage and migrations
* Real payment gateway integration for registration, rentals, and applicable services
* Real email delivery and automated notifications
* Real-time notifications for complaint lifecycle events
* Advanced analytics dashboards and resolution-time reports
* Configurable escalation and service-level policies
* Enhanced rental lifecycle and financial management
* Mobile-friendly experience and accessibility improvements
* Production deployment, monitoring, backups, and audit tooling

---

> This project is developed as part of an academic full-stack development course with a focus on real-world apartment-community operations, community administration, maintenance management, and resident services.
