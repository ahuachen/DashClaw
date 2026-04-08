# Watchouts

## 1. Do Not Sweep In Local Scratch Files

There are often many unrelated untracked local files and directories in this workspace.

Examples seen during this session:

- `graphify-pilot/`
- `docs/research/`
- `.organism/backlog/`
- miscellaneous handoff and concept notes

Do not stage or commit those unless explicitly asked.

## 2. Pre-commit May Regenerate Artifacts

Git hooks may regenerate:

- `docs/api-inventory.json`
- `docs/api-inventory.md`
- `docs/openapi/critical-stable.openapi.json`

After commit, always check `git status` to make sure the worktree is still clean.

## 3. Contracts Are Now A Real Gate

If you change public SDK methods or required setup surfaces and forget the contract files, CI should fail.

Important files:

- [public-surface.json](../../contracts/sdk/public-surface.json)
- [release-plan.json](../../contracts/sdk/release-plan.json)
- [index.json](../../contracts/index.json)

## 4. Startup Smoke Can Look Healthy Before It Fully Exits

The smoke runner may print:

```text
[startup-smoke] configured: Dashboard is configured
```

That means readiness succeeded, but CI is only truly healthy if the process tears down cleanly afterward.

The current fix relies on killing the full detached process group on POSIX.

Relevant files:

- [startup-smoke.mjs](../../scripts/startup-smoke.mjs)
- [startup-smoke.mjs](../../scripts/lib/startup-smoke.mjs)

## 5. Docs Links Must Be Repo-Relative

Do not put absolute local filesystem links into markdown docs.

Past failure pattern:

- `/C:/Projects/...` links broke `npm run docs:check`

Use repo-relative markdown links in docs.

## 6. Python Convergence Should Stay Domain-Scoped

Do not try to close all remaining Python parity at once.

Safer pattern:

1. one domain
2. one contract update
3. one targeted test file
4. one docs update

## 7. The Most Valuable Next Work Is Still Convergence, Not Breadth

The repo has enough product surface already.

High-value work is:

- making setup/startup safer
- making SDK/public surface drift impossible to miss
- making Node and Python converge by domain

Lower-value work right now:

- adding new categories of features
- broadening legacy surfaces
- more admin sprawl without convergence
