# Git workflow

`main` is the stable integration branch. Work on a focused branch and open a pull request; do not directly push unfinished work to `main`.

```text
git checkout main
git pull origin main
git checkout -b feature/<scope>
```

Suggested scopes include resident portal, tower representative portal, maintenance worker portal, and middleware/revenue documentation. The integration owner performs final E2E and consistency work after merges.

Before opening a PR:

- Update from `main` and resolve conflicts locally.
- Run relevant syntax checks, backend build/tests, and browser checks where applicable.
- Run `git diff --check`.
- Commit only your intended files.

Every PR description must state what changed, files changed, tests performed, and known limitations.

If the worktree is already dirty, list the intended files before editing and leave unrelated changes intact. Use a focused commit; do not use broad staging or destructive Git commands to make the tree appear clean.
