# API rules

All portal requests must use `window.UrbanityApi` from `front-end/api.js`. Do not add raw `fetch()` to portal code or create another API transport.

`UrbanityApi` stores the access token/current user in session storage, adds a bearer token to authenticated requests, parses JSON/blob responses, normalizes API errors, clears an unauthorized session, and redirects to sign-in when configured.

## Before calling an endpoint

1. Inspect the controller and DTO.
2. Confirm guard/role requirements and service-level ownership/scope checks.
3. Confirm request body and `{ success, data }` response shape.
4. Handle validation, forbidden, unauthorized, and not-found errors in the current UI.

## Confirmed API areas

- Authentication: `/auth/login`, `/auth/me`
- Hierarchy: `/communities`, `/towers`, `/floors`, `/apartments`, hierarchy association/lookups
- Users: `/users`
- Workforce: `/workforce/workers`
- Complaints: `/complaints`, status, eligible-worker, assignment, start/resolve operations
- Attachments: `/complaints/:complaintId/attachments`
- Reviews: `/complaints/:id/review`
- Analytics: `/dashboard/summary`, `/reports/overview`

## Request and response conventions

- JSON requests use DTO-shaped bodies; UUID route parameters are validated by backend pipes/services.
- The standard response wrapper is `{ success, data }`; failures are `{ success: false, error: { statusCode, message, path } }`.
- Pass `{ responseType: "blob" }` through `UrbanityApi` only for binary attachment retrieval.
- Do not redirect manually after an API failure. Let the shared transport handle unauthorized sessions unless a portal intentionally needs to keep its current workspace visible while it shows an error.
- After a mutation, reload the relevant scoped resource from the backend rather than synthesizing authority-sensitive data client-side.

## Scope rules for request bodies

DTO fields such as hierarchy IDs describe a requested resource or association; they do not grant scope. The backend derives the actor from the JWT and verifies that a requested tower/apartment/worker belongs to the actor's permitted community or ownership boundary.

Use `FormData` for file upload; the transport handles it without forcing JSON content type. Do not invent endpoints or send client-selected authorization scope as an authority signal.
