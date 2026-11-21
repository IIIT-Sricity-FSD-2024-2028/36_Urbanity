# Urbanity backend

NestJS 11 + TypeScript API for the five Urbanity roles: Super Admin, Community
Admin, Tower Representative, Resident, and Maintenance Worker. It uses seeded
in-memory repositories, bcrypt password verification, JWT authentication,
backend role/scope checks, DTO validation, Helmet, and an explicit CORS allowlist.

See [the root setup guide](../README.md#run-a-fresh-clone-or-submission-zip-windows-powershell)
for prerequisites, both terminals, environment configuration, verified development
credentials, troubleshooting, and source ZIP instructions.

From this directory (Node >=22.12, npm >=10):

```powershell
npm.cmd ci
npm.cmd run start:dev
```

Defaults work without a `.env`. To customize, `Copy-Item .env.example .env` and
restart. Shell environment variables override the file. API: http://localhost:3000;
Swagger: http://localhost:3000/api/docs. No global route prefix is applied.
Authentication endpoints are `POST /auth/login` and protected `GET /auth/me`.
Logout clears the browser session; no logout or refresh endpoint exists.

```powershell
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run start:prod
```

`start:prod` runs previously compiled `dist/main.js`; build first. It does not set
NODE_ENV automatically. Production must supply JWT_SECRET with NODE_ENV=production.
Development demo accounts are seeded every restart; business records are not
persisted. Runtime logs/uploads and generated Swagger output are not prerequisites.
