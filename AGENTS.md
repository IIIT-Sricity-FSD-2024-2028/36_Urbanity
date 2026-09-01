# Urbanity contributor guide

**Read this file before modifying the project.** Then read the relevant document in `docs/` and inspect the existing implementation before editing.

## Purpose and baseline

Urbanity is a multi-community apartment operations platform for hierarchy management, maintenance work, and resident complaints. Preserve existing functionality and make the smallest safe change. Do not modify unrelated modules.

## Source of truth and decision order

When documentation, UI, and code disagree, use this order: **backend controller/DTO/service behavior**, then active frontend behavior, then these contributor documents, then older README/design material. Do not "fix" a disagreement by guessing. Record the mismatch, confirm the intended contract with the integration owner, and make a separately scoped change.

Before editing, identify the actor, resource, allowed scope, endpoint/DTO, current UI pattern, and verification needed. If any item is unclear, stop before changing behavior.

## Final actors

| Enum | Display name |
| --- | --- |
| `SUPER_ADMIN` | Super Admin |
| `COMMUNITY_ADMIN` | Community Admin |
| `TOWER_REPRESENTATIVE` | Tower Representative |
| `RESIDENT` | Resident |
| `MAINTENANCE_WORKER` | Maintenance Worker |

The hierarchy is **Community → Tower → Floor → Apartment**. Maintenance workers are community-scoped and are not permanently assigned to towers.

Complaints follow `SUBMITTED → UNDER_REVIEW → ASSIGNED → IN_PROGRESS → PENDING_VERIFICATION → RESOLVED → REVIEWED → CLOSED`. A worker submits proof before the responsible authority verifies the resolution; each transition is backend-authorized.

## Architecture rules

- Frontend: static HTML/CSS/JavaScript portals plus `front-end/api.js` (`window.UrbanityApi`).
- Backend: NestJS controllers, DTOs, services, guards, middleware, a global exception filter, and in-memory data resources.
- JWT authentication and backend-derived identity/scope are authoritative.
- Use `window.UrbanityApi`; do not use raw `fetch()` in portal code.
- Do not invent endpoints, API payloads, permissions, or replacement workflows.
- Do not use mock data for active features.
- Do not treat legacy folders, static placeholder markup, or stale local-storage compatibility code as active contracts.
- Keep the active five portals independent of `front-end/Dept Head/`.

## UI and development rules

- Reuse the established Super Admin and Community Admin visual patterns.
- Follow the concrete palette, shell, typography, component, feedback, and responsive rules in `docs/UI_GUIDELINES.md`.
- Preserve the sidebar/topbar layout and portal consistency.
- JavaScript-handled CRUD must prevent default submission, preserve the current workspace, refresh relevant data only, and show feedback without reloading the page.
- Do not use browser `alert`, `confirm`, or `prompt` for normal new workflows; use existing application feedback/modal patterns.
- Do not change page navigation, topbar, sidebar, or global styles while implementing a scoped feature unless that change is explicitly required.

## Security rules

- Never trust client-supplied role, community, tower, apartment, or ownership scope.
- Never add `X-Role`, fake identity fields, frontend JWT decoding for authorization, local-storage authorization, hard-coded credentials, or credential/token logging.
- Keep authorization and ownership checks in guards/services.

## Working and Git rules

- Do not change role names, authentication/JWT architecture, backend contracts, or another teammate's scope without coordination.
- Work on a feature branch; keep `main` stable and use pull requests.
- Before a PR, run relevant syntax/build/tests and `git diff --check`.
- Document exactly what was tested; do not claim browser or automated tests that were not run.
- Inspect `git status` before editing. Do not stage, revert, format, or overwrite another person's unrelated work.

## Team ownership

| Owner | Primary scope |
| --- | --- |
| Rohit | Resident portal and UI |
| Sanjay | Tower Representative portal and UI |
| Sankeerth | Maintenance Worker portal and UI |
| Karthikeya | Middleware and revenue-model documentation only; no payment integration |
| Akshith | Final E2E, integration, bug fixes, and consistency audit |

## Prohibited changes

Do not reintroduce obsolete actors, delete legacy code without an approved cleanup audit, add payment processing, add duplicate API helpers, or rewrite unrelated features. See `docs/` for the detailed rules.
