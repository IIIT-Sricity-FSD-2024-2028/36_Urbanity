# Urbanity contributor guide

Read this file before modifying the project. Inspect the existing implementation, the relevant backend contract, and any applicable reference material before editing. Preserve existing functionality, keep changes within the requested scope, and do not modify unrelated modules.

## Project overview

Urbanity is a multi-community apartment operations platform for hierarchy management, maintenance work, and resident complaints. The repository contains:

- `back-end/` — NestJS controllers, DTOs, services, guards, middleware, and data resources.
- `Database/` — database-related project material; do not change unless explicitly requested.
- `docs/` — read-only project reference material by default.
- `Figma Designs/` — visual references; do not modify unless explicitly requested.
- `front-end/` — the legacy frontend and the React migration.

The frontend is being migrated from static HTML/CSS/JavaScript to React and Vite. The two implementations must coexist until an approved cleanup task removes legacy code.

## Source of truth

When documentation, UI, and code disagree, use this order:

1. Backend controller, DTO, guard, and service behavior.
2. Active working frontend behavior.
3. Current contributor and project documentation.
4. Older README, Figma, screenshot, mock, or design material.

Do not resolve disagreements by guessing. Record the mismatch, confirm the intended contract with the integration owner, and keep any contract change separately scoped.

Before changing behavior, identify the actor, protected resource, allowed scope, endpoint and DTO, current UI pattern, and required verification.

## Active roles and domain constraints

The active backend roles are exactly:

| Enum | Display name |
| --- | --- |
| `SUPER_ADMIN` | Super Admin |
| `COMMUNITY_ADMIN` | Community Admin |
| `TOWER_REPRESENTATIVE` | Tower Representative |
| `RESIDENT` | Resident |
| `MAINTENANCE_WORKER` | Maintenance Worker |

Do not introduce obsolete actors from `front-end/Dept Head/` or invent additional application roles.

The hierarchy is **Community → Tower → Floor → Apartment**. Maintenance workers are community-scoped and are not permanently assigned to towers.

Complaints follow:

`SUBMITTED → UNDER_REVIEW → ASSIGNED → IN_PROGRESS → PENDING_VERIFICATION → RESOLVED → REVIEWED → CLOSED`

Each transition is backend-authorized. A worker submits proof before the responsible authority verifies resolution. Never infer mutation authority solely from frontend visibility or complaint read access.

## Team ownership

| Owner | Primary scope |
| --- | --- |
| Akshith | Super Admin, Authentication/Login, final integration consistency |
| Karthikeya | Community Admin, Landing Page |
| Sanjay Varma | Tower Representative |
| Sankeerth | Maintenance Worker |
| Rohit | Resident |

Actor feature directories are:

- `front-end/src/features/super-admin/`
- `front-end/src/features/community-admin/`
- `front-end/src/features/tower-representative/`
- `front-end/src/features/maintenance-worker/`
- `front-end/src/features/resident/`

Authentication-related React work belongs to Akshith. Landing-page React work belongs to Karthikeya. Do not implement another developer's actor module without explicit coordination.

## React foundation

The committed shared React foundation includes React and Vite, the Axios API client, authentication state and session restoration, React Router and role guards, public and portal layouts, role-aware navigation, shared UI/data-display components, shared feedback states, centralized constants, and shared styles/design tokens.

Shared infrastructure lives under:

- `front-end/src/api/`
- `front-end/src/auth/`
- `front-end/src/app/`
- `front-end/src/components/`
- `front-end/src/layouts/`
- `front-end/src/constants/`
- `front-end/src/styles/`

Reuse this foundation. Do not independently recreate API clients, authentication state, JWT/session handling, route guards, routers, layouts, sidebars, topbars, buttons, cards, modals, dialogs, tables, toast systems, or loading/error states.

If a genuinely reusable improvement is required, inspect the existing implementation, make the smallest compatible shared change, verify all actor routes still build, and report the shared change clearly. Do not move actor-specific business logic into shared components.

## Actor feature structure

Actor features should generally follow this structure when the actual functionality needs it:

```text
front-end/src/features/<actor>/
├── pages/
├── components/
├── services/
├── hooks/
└── routes.jsx
```

Do not create empty or unnecessary files merely to reproduce this structure. Keep pages, services, hooks, and components focused on the owning actor.

The five actor modules are intended to be developed independently. Do not import another actor's components or services directly. If functionality is genuinely reusable, use an existing shared component or coordinate a minimal addition to the shared area.

## API rules

All React API calls must use `front-end/src/api/client.js`.

Do not:

- Create another Axios instance or duplicate API helper.
- Use raw `fetch()` in React feature code.
- Hard-code backend URLs.
- Duplicate bearer-token or JWT handling.
- Directly manipulate authentication headers in components.
- Create actor-specific authentication systems.
- Invent endpoints, methods, request payloads, permissions, or response structures.

The API base URL is controlled by `VITE_API_URL`.

Keep API calls in feature services rather than presentation components. Preserve backend validation messages where appropriate, and use the shared error behavior from the API client.

## Authentication rules

Authentication is centralized under `front-end/src/auth/`. Use `useAuth()` for the current user, role, authenticated state, loading state, login, logout, and user refresh.

The existing `sessionStorage` keys are:

- `accessToken`
- `currentUser`

Do not create another authentication storage mechanism. Do not decode JWTs in the frontend for authorization. Do not trust client-stored role, community, tower, apartment, or ownership scope as an authorization source.

Do not use legacy HTML authentication redirects or `window.location` for React authentication navigation. Authentication and login UI are owned by Akshith.

## Routing rules

Routing is centralized in `front-end/src/app/router.jsx`. Authorization uses `ProtectedRoute` and `RoleRoute` with role constants from `front-end/src/constants/roles.js`.

- Keep every actor namespace protected by its exact backend role.
- Do not bypass `RoleRoute`.
- Do not create a second router.
- Add paths and navigation through the centralized route/navigation configuration.
- Unauthorized navigation must not clear a valid authenticated session.

## Backend contract and security

The existing backend is authoritative for endpoints, HTTP methods, DTOs, response wrappers, validation, authorization, roles, complaint statuses, associations, ownership, and business rules.

- JWT authentication and backend-derived identity/scope are authoritative.
- Never add `X-Role`, fake identity fields, client-authoritative scope, or hard-coded credentials.
- Never log passwords, tokens, authorization headers, or sensitive credentials.
- Keep community, tower, apartment, complaint, attachment, resident, and worker authorization in backend guards/services.
- Frontend hiding or filtering is not a security boundary.
- Do not silently change backend behavior during an actor migration.

If a required capability is missing, report the gap. Do not fabricate production data, invent a replacement endpoint, or silently implement a different contract. Do not modify backend code during normal actor frontend migration unless explicitly instructed.

## Shared UI rules

Before creating a component, inspect `front-end/src/components/`. Reuse existing shared components and composition patterns.

Do not create separate actor-specific versions of buttons, cards, modals, confirmation dialogs, toast systems, data tables, sidebars, topbars, layouts, or loading/empty/error states.

Generic reusable components belong in the shared component area after coordination. Actor-specific components remain inside the actor feature.

API-driven pages must represent loading, success, empty data, and error states. Mutations must show success or failure feedback and re-enable controls after failure. Use the shared `LoadingState`, `EmptyState`, `ErrorState`, and `ToastProvider` APIs.

Do not use browser `alert`, `confirm`, or `prompt` for normal application workflows. Do not use legacy `window.UIFeedback`.

## Styling and responsive behavior

React styling is centralized under `front-end/src/styles/`. Reuse the existing design tokens and Urbanity visual language: pale application background, white bordered cards, navy sidebar, blue primary actions, compact status badges, system typography, and the established spacing/radius/shadow scale.

- Reuse the Super Admin and Community Admin visual patterns.
- Preserve the shared sidebar/topbar shell and portal consistency.
- Do not duplicate global styles or introduce an unrelated actor theme.
- Keep actor-specific styles scoped to that feature when needed.
- Preserve keyboard focus, contrast, disabled states, narrow-screen controls, modal overflow, and table scrolling.
- Do not add a new UI framework or icon library without explicit approval.

Use `docs/UI_GUIDELINES.md` as a reference when working on UI, but remember that backend behavior remains authoritative for functionality and permissions.

## Legacy frontend

The legacy frontend is reference material and must remain intact during migration:

- `front-end/Authentication/`
- `front-end/Super Admin/`
- `front-end/Community Admin/`
- `front-end/Tower Representative/`
- `front-end/Resident/`
- `front-end/Maintenance Worker/`
- `front-end/Landing Page/`
- `front-end/Dept Head/`
- `front-end/api.js`
- `front-end/global.css`
- `front-end/mockData.js`

Do not delete, rename, move, or casually modify legacy files. They may be inspected for existing functionality and visual behavior, but do not copy legacy `window.location` navigation, HTML redirects, direct session manipulation, obsolete roles, legacy API implementations, or mock-data workflows into React.

Keep all active five-role functionality independent of `front-end/Dept Head/`.

## Mock data

Do not import `front-end/mockData.js` into React actor modules. When backend functionality exists, use it. Do not fabricate production-looking records simply to make a page appear complete.

Static structural placeholders are acceptable only when explicitly requested during foundation work and must not be presented as real application data.

## Documentation and design references

Treat `docs/` as read-only unless the current task explicitly requests a documentation change. Codex may inspect it to understand requirements, architecture, scope, evaluation criteria, APIs, decisions, or workflows.

Do not rename, delete, move, regenerate, format, or rewrite files in `docs/` as collateral work. If documentation conflicts with the backend or active implementation, report the discrepancy rather than rewriting documentation during a feature task.

`Figma Designs/` may be inspected for visual reference. Do not modify its files or assets unless explicitly requested. Do not prioritize stale Figma actor names or flows over the active five-role backend model.

## Shared-file changes

Actor developers should primarily modify their own feature directory. Avoid changing shared API, auth, app, component, layout, constant, or style files unless genuinely necessary.

Before making a shared change:

1. Inspect the current shared implementation.
2. Confirm the requirement cannot be solved within the actor feature.
3. Coordinate when the change affects other owners.
4. Make the smallest compatible change.
5. Verify all actor routes and the production build.
6. Report exactly what changed and why.

Do not stage, revert, format, rename, or overwrite another developer's unrelated work.

## Development and Git workflow

- Inspect `git status` before editing and review changed files before committing.
- Work on the assigned feature branch; keep `main` stable and use pull requests.
- Do not commit unrelated actor or shared changes.
- Do not change role names, authentication architecture, backend contracts, or another teammate's scope without coordination.
- Run relevant syntax checks, builds, and tests, plus `git diff --check`, before a pull request.
- Document exactly what was tested. Do not claim browser or automated tests that were not run.

Preferred commit-message formats:

```text
feat(frontend): <description>
fix(frontend): <description>
refactor(frontend): <description>
docs: <description>
```

## Build verification

After meaningful React changes, run this command from `front-end/`:

```text
npm.cmd run build
```

A React task is not complete while the production build fails. Also run any relevant feature tests and verify responsive behavior, error handling, and role protection in proportion to the change.

## Actor completion requirements

An actor feature is complete only when:

- Existing relevant actor functionality has been migrated.
- Requests match inspected backend contracts.
- Correct protected and role-based routing exists.
- Loading, empty, and error states exist where applicable.
- Mutation success and failure provide visible feedback.
- Responsive behavior is usable.
- No unnecessary mock data is used.
- No legacy HTML navigation or direct session handling is used.
- `npm.cmd run build` passes.
- No unrelated actor or shared files were modified.
- Testing and any remaining gaps or assumptions are reported accurately.

## Prohibited changes

Do not reintroduce obsolete actors, delete legacy code without an approved cleanup audit, add payment processing, create duplicate API/auth/UI foundations, weaken backend authorization, or rewrite unrelated features.

## Default decision process

When uncertain:

1. Inspect the backend controller, DTO, guard, and service.
2. Inspect the owning legacy actor implementation.
3. Inspect relevant files in `docs/` when requirements remain unclear.
4. Inspect and reuse the shared React foundation.
5. Preserve backend contracts and backend-derived authorization.
6. Make the smallest compatible change within the owning feature.
7. Run the build and relevant checks.
8. Report assumptions, contract gaps, tests, and shared changes.

The objective is to migrate Urbanity consistently to React while preserving existing functionality, authorization boundaries, and backend contracts. Do not redesign the backend or invent business functionality during frontend migration.
