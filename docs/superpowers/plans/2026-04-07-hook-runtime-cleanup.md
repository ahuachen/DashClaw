# Hook Runtime Cleanup Plan

Date: 2026-04-07

## Scope

Remove Husky runtime wrapper dependence from local hooks while preserving the
existing pre-commit behavior.

## Tasks

### 1. Add test coverage for the runner

- Create unit tests for a new `runPreCommitChecks` helper
- Cover:
  - success path
  - warn-only contracts path
  - hard failure path

### 2. Add a repo-owned Node runner

- Add `scripts/lib/run-pre-commit-checks.mjs`
- Add `scripts/run-pre-commit-checks.mjs`

Behavior:

1. generate API inventory
2. generate OpenAPI
3. stage generated artifacts
4. run `contracts:check --mode=warn`

### 3. Replace Husky runtime usage

- Update `.husky/pre-commit` to be a thin repo-owned launcher
- Remove reliance on `.husky/_/h`
- remove `prepare: husky` from `package.json`
- remove the `husky` dependency from `package.json`

### 4. Update docs

- Update any docs that imply Husky is the active runtime
- keep the described pre-commit behavior unchanged

### 5. Verify

- run the unit tests
- run `npm run contracts:check`
- run `npm run docs:check`
- run the pre-commit runner directly

## Commit Message

`chore: replace husky runtime with node hook runner`
