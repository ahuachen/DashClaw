# Hook Runtime Cleanup Design

Date: 2026-04-07

## Problem

DashClaw currently uses Husky as the runtime wrapper for Git hooks. On this
Windows environment, Git-for-Windows `sh.exe` crashes before the real
`pre-commit` logic runs:

- `sh.exe: fatal error - couldn't create signal pipe, Win32 error 5`

The actual `pre-commit` behavior is fine. The unstable piece is the shell-based
wrapper path.

## Goal

Keep local Git hook protection while removing the Husky runtime dependency and
the brittle shell-wrapper path.

## Non-Goals

- Do not change the current pre-commit policy.
- Do not add more checks to pre-commit.
- Do not change CI enforcement.
- Do not modify startup, migration, contract, or SDK behavior.

## Recommended Approach

Replace Husky runtime wrappers with a repo-owned Node hook runner.

### New shape

- Keep `core.hooksPath` pointing at a repo-managed hooks directory.
- Keep a lightweight `pre-commit` entrypoint that only dispatches to Node.
- Move the actual behavior into a normal script:
  - `scripts/run-pre-commit-checks.mjs`

### Pre-commit behavior to preserve

1. Regenerate API inventory
2. Regenerate OpenAPI
3. Stage regenerated artifacts
4. Run `contracts:check` in warn-only mode

## Why this is the right fix

- Removes Husky shell indirection from the critical path
- Makes hook behavior explicit and testable
- Keeps the same repo protections
- Reduces Windows-specific shell fragility
- Makes future hook changes normal Node code instead of wrapper debugging

## Implementation Notes

### Hook directory

Keep using `.husky/` for now to avoid changing `core.hooksPath` in every local
clone. The cleanup should remove Husky-generated wrapper files and turn
`.husky/pre-commit` into a thin repo-owned launcher.

### Runtime script

`scripts/run-pre-commit-checks.mjs` should:

- execute the two generation scripts
- stage generated files through Git
- run the warn-only contract check
- return a non-zero exit code only for generation/staging failures

Warn-only contracts should remain non-blocking locally.

### Windows-safe entrypoint

The repo should no longer depend on `prepare: husky` or the `.husky/_` runtime.
The hook entrypoint should use a direct Node invocation path instead of Husky's
shell chain.

## Testing

Add a focused unit test for the new pre-commit runner that verifies:

- the expected commands run in the correct order
- contract warnings do not fail the runner
- hard failures from generation/staging do fail the runner

## Success Criteria

- local `git commit` no longer depends on Husky runtime wrappers
- the pre-commit logic remains identical in behavior
- the runner is unit-tested
- docs that mention local pre-commit behavior stay accurate
