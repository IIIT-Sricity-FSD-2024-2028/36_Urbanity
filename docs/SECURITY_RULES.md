# Security rules

## Mandatory controls

- Use JWT bearer authentication through `UrbanityApi` and backend guards.
- Derive identity from the authenticated backend user, not client input.
- Let services derive and validate community, tower, apartment, ownership, and assignment scope.
- Treat community isolation as a security boundary.
- Keep authorization and IDOR/ownership validation on the backend.

## Never introduce

- `X-Role` or any header-based role trust
- Fake identity, role, or scope fields
- Client-authoritative `communityId`, tower scope, or apartment scope
- JWT community authorization claims or frontend JWT decoding for authorization
- Local-storage authorization
- Hard-coded credentials/password hashes in frontend code
- Credentials or authorization headers in logs
- Frontend filtering as the only access control

## Actual implementation

`JwtAuthGuard` verifies the token then resolves the current user by subject ID. `RolesGuard` validates the role enum and route roles. Community, complaint, attachment, review, and workforce services apply additional ownership/community/assignment checks. Helmet/CORS are configured at application startup; request logging and the HTTP exception filter avoid returning raw internal errors.

## Change review checklist

Before merging an authorization-sensitive change, identify the protected resource, the actor's backend-derived scope, allowed and denied actors, and the service method that enforces the rule. Verify cross-community, wrong-tower, wrong-resident, and wrong-worker attempts fail. Never treat a route decorator alone as proof of complete resource authorization.
