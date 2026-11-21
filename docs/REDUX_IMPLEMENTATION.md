# Urbanity Redux implementation

## Application setup

The React application uses Redux Toolkit and React-Redux. The application store
and its factory are in `front-end/src/app/store.js`. The API reducer and
middleware are registered there once. The application entry point mounts these
providers in order.

```text
StrictMode
  Provider (store)
    AuthProvider
      ToastProvider
        App
```

Use `useAppDispatch` and `useAppSelector` from `src/app/reduxHooks.js` for
Redux dispatch and selection. Use the generated RTK Query hooks for data reads
and mutations. Keep forms, filters, dialogs, files, previews and toast messages
with their existing owners.

## Add endpoints from your feature

The shared API lives in `src/api/urbanityApi.js`. Inject endpoints from your
feature's `services/` directory. Use unique endpoint names with the actor and
resource in the name. Add feature-owned tag types via `enhanceEndpoints` before
injecting when your feature needs its own tags. Use actor-prefixed tag names and
reserve `LIST` for a collection. For a role-specific collection, keep both the
endpoint name and its tags role-specific, even when the HTTP route is shared.

The Super Admin directory demonstrates the complete pattern. The following
excerpt shows how it uses the service and provides collection and entity tags.

```js
const directoryApi = urbanityApi.injectEndpoints({
  endpoints: (build) => ({
    listSuperAdminCommunities: build.query({
      queryFn: (sessionRevision, { signal }) =>
        runServiceQuery(signal, superAdminService.listCommunities, sessionRevision),
      providesTags: (communities) => [
        { type: cacheTags.superAdminCommunity, id: "LIST" },
        ...(communities ?? []).map(({ id }) => ({
          type: cacheTags.superAdminCommunity,
          id,
        })),
      ],
    }),
  }),
});
```

Import the shared API and `runServiceQuery` from `src/api/urbanityApi.js`.
Call your existing feature service and pass through the signal using its
parameter signature. Keep request handling, envelopes, bearer headers and URL
configuration in the existing services and Axios client. `runServiceQuery`
maps rejected requests to plain `{ status, message }` errors and preserves
the validation text produced by Axios. In the UI, use the query's loading and
error fields for feedback, and use `.unwrap()` on a mutation trigger to handle
its success and failure.

Invalidate the affected entity or list tag after a successful write. Keep
independently fetched resources separate, so that retry can refresh only the
failed read. Invalidation already refetches active subscriptions. Use route
entry revalidation where other users or workflows can change the underlying
records and keep a retry available after a failed fetch.

The two Super Admin pages share `useSuperAdminCommunityDirectory`. Updates
invalidate the changed entity and deletion invalidates the entity and list.
Community creation uses the same existing Axios service outside Redux because
its request includes a temporary administrator password. After creation, the
feature dispatches a tag-only invalidation, and the Communities page refreshes
the administrator and subscription lookups.

## Session lifecycle

AuthContext owns login, restoration, user refresh and logout. The Axios client
retains the existing session storage keys and tracks an in-memory revision. It
advances on clear and when the token, identity or role changes. The production
store listens for these boundaries and dispatches `resetApiState`, which clears
the cache and cancels in-flight RTK Query work. Axios captures the revision
when issuing a request. A delayed 401 only clears the session if that revision
is still current. The `/auth/me` deduplication and application of refreshed
session data are also scoped to that revision.

Use `useAuth()` to gate private query subscriptions on session restoration and
the appropriate role. When adding private queries, include `sessionRevision`
with the cache arguments, use `currentData` to avoid showing the previous
argument's data, and send only the actual resource arguments to the API. For a
detail query, for example, use `{ sessionRevision, id }` and pass `id` to the
service. Pass the revision to `runServiceQuery` so it can reject a stale
subscription before making a request. The revision has no authorization meaning. The backend still makes
every authorization decision.

Keep access tokens, passwords, files, blobs and raw Axios errors out of Redux
action arguments and state. For existing credential-bearing writes and uploads,
call the service directly. If the request succeeds in the same session,
dispatch an invalidation containing only the affected tags. Keep the cache in
memory.

## Verification commands

From `front-end/`, run these commands before opening a PR.

```powershell
node --test test/redux.foundation.test.mjs
node --test src/features/amenities/components/reservationDates.test.mjs src/features/community-admin/rentalForms.test.mjs src/features/community-admin/rentalView.test.mjs src/features/registration/registrationModel.test.mjs
node --test test/registration.browser.mjs
npm.cmd run build
git diff --check
```

The foundation tests load app modules through Vite SSR and use the real Redux
store configuration with an Axios adapter stub. The browser test requires
installed frontend and backend dependencies and Edge or `CHROMIUM_PATH`. For
your feature, verify that successful writes update the relevant pages, failed
writes restore controls, and protected routes preserve the authenticated
session when denying another role.
