# Urbanity - Multi-Community Apartment Operations Platform

## Problem statement

Apartment communities often handle maintenance through calls, chat messages, and disconnected records. That makes it difficult to locate a reported issue, route it to the right authority, schedule an eligible worker, and verify the repair.

Urbanity centralizes community onboarding, tower and apartment administration, resident services, and complaint management. Residents can follow an issue from submission through verified resolution. Workers and community staff can coordinate assignments, appointments, repair estimates, and approvals within their role and community scope.

---

## Identified Actors

1. **Super Admin** reviews community registrations and oversees communities, platform users, subscriptions, and cross-community activity.
2. **Community Admin** manages one community's hierarchy, residents, workforce, amenities, and paid services. They handle community-wide complaints and approve tower-verified repair estimates for mock payment.
3. **Tower Representative** manages complaint review, worker assignment, appointments, and repair verification for their assigned tower.
4. **Resident** submits and tracks their own complaints, reviews verified repairs, books amenities, and requests paid services.
5. **Maintenance Worker** manages assigned complaints and service requests, coordinates visits, submits estimates, performs repairs, and uploads completion proof.

---

## Planned Features (Actor wise)

The features below describe the implementation, which contains the completed subscription and complaint estimate workflows.

### Super Admin

- Review and approve or reject community registrations after checking applicant authority and initial payment records.
- Use **Accept & Send Email** to record a simulated approval notification.
- Manage communities and platform users, including Community Admin accounts, and monitor cross-community complaints, workforce activity, dashboards, and reports.

### Community Admin

- Manage the **Community → Tower → Floor → Apartment** hierarchy, resident accounts and apartment ownership, Tower Representatives, and Maintenance Workers.
- Monitor workforce availability, resident feedback, reports, and community operations.
- Review and assign community-wide complaints, verify repair proof, and close reviewed cases.
- Approve or reject tower-verified complaint estimates and execute mock repair payments. Review estimate history and payment receipts.
- Manage the community subscription, remaining platform payment, and platform payment history and receipts.
- Configure amenities, booking rules, fees, and refundable deposits. Manage resident bookings and the paid services available in the community.

### Tower Representative

- Review apartment and tower complaints, assign eligible Maintenance Workers, and manage maintenance appointments.
- Verify submitted estimates, return them to the worker for revision, or reject them. Each new revision requires fresh verification.
- When the assigned worker becomes unavailable, cancel the current unpaid estimate with a recorded reason and reassign the complaint. The replacement submits a new estimate, and the previous estimate and assignment remain in the audit history.
- Verify repair proof, rate completed work, close reviewed cases, and monitor tower residents and complaint activity.

### Resident

- Submit apartment, tower, or community complaints, attach photos, request maintenance appointments, and track progress and estimate status.
- Rate verified repairs on speed, quality, and communication, and leave optional written feedback. Internal estimate line items, notes, and payment receipts stay within authorized staff views.
- Book amenities and view reservation details, charges, and refundable deposits. Browse paid services, request work, and track estimates, appointments, and final charges.

### Maintenance Worker

- View assigned work, complaint details and locations, and scheduled visits.
- Inspect apartment and tower complaints and submit itemized estimates with a proposed repair, costs, and expected completion time. Revise and resubmit when requested.
- Start approved repairs once the backend records a successful mock payment for the current assignment. Submit resolution notes and photo proof for authority verification.
- Track assigned, in-progress, and completed work. Provide estimates, coordinate appointments, and record work progress and final costs for assigned paid-service requests.

**Platform subscription mock payment.** Submit a community registration and pay the initial 20% of the platform fee. The fee is based on the registered tower and apartment counts, and the initial amount is rounded up to a whole rupee. After Super Admin approval, the applicant sets an individual password through the private registration status page. The Community Admin then signs in and pays the remaining 80% (the outstanding balance after rounding) on the platform payment page to unlock community operations.

**Complaint repair mock payment.** For an apartment or tower complaint, the assigned worker inspects the issue and submits an itemized estimate. The Tower Representative verifies it, the Community Admin approves it and records the mock payment, and the same worker can then start the repair. Resolution still requires worker proof and authority verification, followed by resident review and authority closure. Community-wide complaints use the existing Community Admin assignment and verification workflow without a repair estimate or payment.

The two payment workflows are independent and evaluation-only. Neither connects to a real payment gateway or moves money.

---

## Project Goals

- Centralize community onboarding, apartment and resident administration, complaints, workforce coordination, and resident services.
- Keep work within role, community, tower, and complaint ownership boundaries.
- Make complaint progress visible to residents from submission through verified repair and review.
- Keep assignments, estimate revisions, approval decisions, and mock payments traceable to the people who acted on them.
- Give authorized staff clear records of platform fees and repair payments, with oversight of complaint activity and worker performance.

---

## Tech Stack

- **Frontend** — React, Vite, JavaScript, HTML, CSS, React Router, and Axios.
- **State and API caching** — Redux Toolkit and React-Redux provide a centralized store. Features inject endpoints into a shared RTK Query API for cached reads and mutations through the existing Axios client. Successful mutations invalidate relevant cache tags so active views refresh. Authentication keeps its existing session handling and resets the API cache on session changes. Requests from an earlier session cannot populate the current cache.
- **Backend** — Node.js, NestJS with Express, TypeScript, and Swagger/OpenAPI.
- **Validation and security** — NestJS JWT authentication, role and ownership checks, bcrypt password hashing via `bcryptjs`, `class-validator`, `class-transformer`, Helmet, and CORS.
- **Data** — The running application uses in-memory repositories. Registration payments, complaint estimates and revisions, repair payment receipts, and their audit history are lost on backend restart. The [SQL schema](Database/DBschema.sql) and [ER diagram](Database/ER%20Diagram.png) are design references.
- **Testing** — Jest and Supertest for backend and API tests. The Node.js test runner covers frontend and Redux tests, with Chromium-based browser integration checks.

---

## Run locally

Use Node.js **22.12 or newer**, npm **10 or newer**, and internet access for the initial dependency install. Check with `node --version` and `npm.cmd --version`. The default setup needs no database or external services. Use both directories from the same checkout.

Start the backend in one PowerShell terminal from the repository root.

```powershell
cd back-end
npm.cmd ci
npm.cmd run start:dev
```

Start the frontend in a second PowerShell terminal from the repository root.

```powershell
cd front-end
npm.cmd ci
npm.cmd run dev
```

Open [Urbanity](http://localhost:5173) or go directly to [Sign in](http://localhost:5173/login). The backend defaults to port 3000. Wait for Nest to report successful startup before signing in. [Swagger API documentation](http://localhost:3000/api/docs)

The backend seeds evaluation accounts on startup. The seeded Super Admin signs in with `superadmin@urbanity.local` and `superadmin-dev`. Newly approved Community Admins set their own passwords.

### Optional environment configuration

The defaults work without local `.env` files. To override them, copy the tracked templates from the repository root and edit the local copies.

```powershell
Copy-Item back-end/.env.example back-end/.env
Copy-Item front-end/.env.example front-end/.env
```

- **Backend** — Start from `back-end/` so Nest loads its local `.env`. Shell values take precedence. `PORT` defaults to `3000`, `CORS_ORIGIN` accepts a comma-separated allowlist, and `JWT_EXPIRES_IN` defaults to `1h`. Development has a built-in JWT secret. With `NODE_ENV=production`, set a strong, unique `JWT_SECRET`.
- **Frontend** — `VITE_API_URL` defaults to `/api`. Vite proxies `/api/auth/login` to `/auth/login` on `API_PROXY_TARGET`, which defaults to `http://localhost:3000`. Set the proxy target to match a custom backend port. For direct API calls, set `VITE_API_URL` to the backend origin without `/api` and add the frontend origin to `CORS_ORIGIN`. Keep secrets out of `VITE_*` variables because they are included in the browser build.

After changing configuration, restart both servers. Rebuild when frontend build-time values change.

### Verification and troubleshooting

Run these commands from the repository root after installing dependencies.

```powershell
cd back-end
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
cd ../front-end
npm.cmd test
node --test "test/redux.*.test.mjs"
npm.cmd run build
npm.cmd run test:browser
node --test test/complaint-estimates.browser.mjs
```

The browser checks need Microsoft Edge or `CHROMIUM_PATH` pointing to a Chromium executable. `npm.cmd run test:browser` runs the registration browser test. The complaint estimate browser test is available on the workflow branch named above.

Run `npm.cmd run preview` from `front-end/` to preview the production build at [localhost:4173](http://localhost:4173). Keep the backend running. Static hosting needs an equivalent `/api` reverse proxy or an explicit backend origin with the corresponding CORS configuration.

- For a sign-in **404**, check that Vite receives `POST /api/auth/login` and forwards it as `POST /auth/login`.
- For a **proxy connection error**, check backend startup and confirm `API_PROXY_TARGET` matches the backend port. A **401** indicates invalid credentials or an expired session.
- If a port is occupied, stop the conflicting process or set a different backend `PORT` and matching proxy target. To change the frontend port, use `npm.cmd run dev -- --port 5174` and update `CORS_ORIGIN` if making direct API calls.

To create a source-only submission ZIP from a tested commit, run this command from the repository root. Extract it and repeat the two-terminal setup.

```powershell
git archive --format=zip --prefix=Urbanity/ --output=Urbanity-submission.zip HEAD
```

---

## Future Enhancements

* Add database-backed persistence and migrations for community data, estimates, payment receipts, and audit history, with transactional protection across server instances.
* Integrate a real payment gateway with verified callbacks and reconciliation for platform fees and eligible repair payments.
* Harden production authentication and authorization with secure account recovery, multi-factor authentication for administrators, and periodic access reviews.
* Deliver real email or in-app notifications and push live updates for appointments, estimate decisions, and complaint status changes.
* Add configurable escalation policies, historical reporting, and production deployment with monitoring, backups, and support for multiple instances.

---

> This project is developed as part of an academic full-stack development course with a focus on real-world apartment-community operations, community administration, maintenance management, and resident services.
