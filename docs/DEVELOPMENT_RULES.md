# Development rules

Before coding:

1. Read `AGENTS.md` and the relevant `docs/` files.
2. Inspect the existing implementation and backend contract.
3. Reuse existing utilities and UI patterns.
4. Make the smallest safe change and verify it.

Do not rewrite unrelated modules, redesign another portal, change a contract without coordination, duplicate API utilities, add mock data to active features, hard-code backend statistics, rename roles, bypass authorization, or add unnecessary dependencies.

Keep changes within team ownership when possible. Preserve current behavior, especially cross-role/community isolation and non-reloading CRUD flows. If a requested change needs an unknown endpoint or permission, stop and confirm the backend contract instead of guessing.

Do not modify legacy code as collateral cleanup. It requires its own audit and explicit scope.

## Definition of done

A change is ready only when its affected role and scope are known, its UI follows the existing portal pattern, its request matches an inspected DTO/controller, its success/error behavior is visible without a full page reload, and the relevant checks are recorded. Do not bundle documentation cleanup, visual redesign, role migration, and business-logic changes into one unreviewed change.
