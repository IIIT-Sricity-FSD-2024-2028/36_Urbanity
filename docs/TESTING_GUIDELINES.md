# Testing guidelines

Test the scope you change. Do not claim a test passed unless it was run.

## Minimum checks

- Run syntax checks for changed JavaScript.
- Run `npm run build` when backend TypeScript changes.
- Run relevant unit tests and `npm run test:e2e` when applicable.
- Run `git diff --check`.
- Browser-test changed frontend workflows where possible.

## CRUD checks

For each changed mutation, verify that the page does not reload, the request reaches the backend, data persists, only relevant UI data refreshes, errors are visible, and role/community permissions are respected.

## Authorization checks

For scope-sensitive features, exercise allowed and denied cases across community, tower, resident ownership, and worker assignment boundaries. Test attachments/reviews with their associated complaint access rules.

## Lifecycle regression checks

When changing complaint code, test the supported sequence: create as the owning Resident; review as the responsible authority; assign only an eligible same-community worker; start/resolve as that assigned worker; review as the owning Resident; and close as the responsible authority. Also test one invalid transition and one cross-scope attempt.

## Evidence to record

Record exact commands, affected browser role(s), test data/setup, result, and any checks not run. A static code review is not a substitute for browser or E2E verification.
