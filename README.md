# Urbanity - Multi-Community Apartment Operations Platform

## Problem Statement

Apartment communities often manage maintenance issues through calls, chat messages, and disconnected records. This makes it difficult to identify the exact complaint location, route the issue to the responsible authority, assign an eligible maintenance worker, and verify that the work was completed correctly.

The absence of a centralized, transparent, and trackable workflow can lead to delayed repairs, poor coordination between residents and authorities, and limited accountability for maintenance work.

This project aims to build a **multi-community apartment operations platform** that allows Residents to report complaints, enables Community Admins and Tower Representatives to manage and assign work, and ensures accountability through verified proof of work and resident feedback.

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
- Monitor cross-community complaints, workforce, dashboards, and reports
- Maintain platform-wide visibility and administration
- Manage Community Admin accounts and platform operations

---

### Community Admin

- Manage the Community -> Tower -> Floor -> Apartment hierarchy
- Create and manage Residents, Tower Representatives, and Maintenance Workers
- Review and assign community-level complaints to eligible workers
- Verify proof of work for Community complaints
- Monitor community dashboards, workforce availability, and resident feedback

---

### Tower Representative

- View complaints routed to the assigned tower
- Review Apartment and Tower complaints before assignment
- Assign eligible and available Maintenance Workers
- Verify submitted proof of work and rate worker quality
- View tower residents, complaint activity, and worker performance

---

### Resident

- Raise Apartment, Tower, or Community complaints
- Upload supporting images for better issue clarity
- Track the progress of submitted complaints
- Receive resolution updates after authority verification
- Rate completed work on speed, quality, and communication
- Provide optional written feedback after issue resolution

---

### Maintenance Worker

- View authorized assigned maintenance tasks
- Access complaint type, exact location, issue details, and required specialization
- Start assigned work and update work progress
- Submit proof of work with resolution notes and supporting images
- Track assigned, in-progress, and completed work

---

## Project Goals

- Improve transparency in apartment maintenance management
- Reduce issue-resolution time through clear routing and assignment
- Enable accountability at every stage of the complaint lifecycle
- Improve resident satisfaction through verified resolutions and feedback
- Maintain secure community, tower, resident, and worker scope boundaries
- Provide data-driven insights into complaint activity and worker performance

---

## Tech Stack (Planned)

- **Frontend:** HTML, CSS, and JavaScript
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
```

The API runs at `http://localhost:3000`.

Start the frontend in the second terminal:

```powershell
cd front-end
npx.cmd serve -l 3001
```

Open the sign-in page at `http://localhost:3001/Authentication/auth.html`.

Development Super Admin credentials:

```text
Email: superadmin@urbanity.local
Password: superadmin-dev
```

---

## Future Enhancements

- Persistent database storage and migrations
- Real-time notifications for complaint lifecycle events
- Advanced analytics dashboards and resolution-time reports
- Configurable escalation and service-level policies
- Mobile-friendly experience and accessibility improvements
- Production deployment, monitoring, backups, and audit tooling

---

> This project is developed as part of an academic full-stack development course with a focus on real-world apartment-community operations and maintenance management.
