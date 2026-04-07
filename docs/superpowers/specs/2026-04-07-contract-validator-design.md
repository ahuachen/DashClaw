---
source-of-truth: false
owner: Platform
last-verified: 2026-04-07
doc-type: spec
status: proposed
---

# Contract Validator Design

## Purpose

Define a validator-first convergence system for DashClaw so feature work stops relying on manual synchronization across:

- API routes,
- database schema and setup migration safety nets,
- Node and Python SDK surface area,
- generated docs artifacts,
- and SDK release/version planning.

This spec introduces a canonical contract layer and a single validation runner that fails CI when the repo drifts away from declared platform expectations.

## Why This Matters

DashClaw currently has multiple partially independent surfaces that must be kept in sync by hand:

- route implementation,
- setup/runtime migration logic,
- schema assumptions in repositories and runtime helpers,
- canonical SDK wrappers and legacy compatibility shims,
- generated OpenAPI and API inventory artifacts,
- and release/version metadata for public SDK changes.

The recent capability detail failure is an example of the class of problem this creates:

- code began assuming newer `action_records` fields,
- older deployments still had a reduced schema shape,
- setup drift was not hard-failed before deploy,
- and the problem surfaced only after pushing to production.

The issue is not one missing migration. The issue is that DashClaw lacks one authoritative declaration layer that can be checked mechanically.

## Product Decision

DashClaw should adopt a validator-first contract system before attempting broad code generation.

Phase 1:

- declare contracts by domain,
- validate repo state against those contracts,
- warn locally in pre-commit,
- hard-fail in CI,
- and require explicit SDK release-plan updates when public SDK surface changes.

Phase 2:

- add targeted autofix and generator helpers for repetitive tasks after the rules stabilize.

## Goals

1. Make cross-surface drift visible before deploy.
2. Fail CI when a feature changes a declared public or runtime contract without completing the required supporting updates.
3. Provide actionable, specific failure output instead of generic “docs drift” or “migration stale” errors.
4. Preserve the current architecture while adding an authoritative declaration layer above it.
5. Create a foundation for future automation without making generation mandatory in v1.

## Non-Goals

1. Do not replace the current route, SDK, or migration architecture.
2. Do not auto-generate all SDK code in v1.
3. Do not auto-generate all database migrations in v1.
4. Do not attempt to govern UI copy, marketing docs, or product prose in v1.
5. Do not infer semantic version bumps automatically without an explicit release-plan update.

## Current State

As of this spec:

- `.husky/pre-commit` regenerates OpenAPI and API inventory artifacts only.
- CI already enforces `docs:check`, `openapi:check`, `route-sql:check`, and SDK integration checks.
- `/api/setup/migrate` functions as a runtime schema safety net, but there is no validator ensuring it actually reconciles the fields required by current code.
- SDK policy docs describe canonical vs legacy ownership, but no machine-enforced check verifies that public surface changes include release intent.
- Several generated or checked surfaces are derived from code, but their relationship to platform requirements is implicit rather than declared.

## Core Problem

DashClaw currently has no single place that answers:

- What APIs are public and expected to remain documented?
- What schema columns and indexes are required by runtime code?
- What setup/migration guarantees must hold for older deployments?
- Which SDK wrappers are required for a given API surface?
- When does a public SDK change require a planned version bump?

Without that layer, feature work continues to create hidden synchronization debt.

## Recommended Architecture

Use split domain contracts with one top-level index.

Top-level structure:

- `contracts/index.json`
- `contracts/api/*.json`
- `contracts/schema/*.json`
- `contracts/setup/*.json`
- `contracts/sdk/*.json`

This avoids a single giant manifest while preserving one entry point for the validator runner.

## Contract Layout

## Contract Index

### File

- `contracts/index.json`

### Responsibility

The index defines:

- contract schema version,
- enabled validator domains,
- contract file paths,
- enforcement mode defaults,
- and repo-wide validator policy.

Example responsibilities:

- register the schema contract files that matter,
- register the SDK release-plan file,
- enable or disable specific validators while rolling out incrementally.

## API Contracts

### Directory

- `contracts/api/*.json`

### Responsibility

Each API contract declares canonical expectations for public or semi-public HTTP surfaces:

- route path,
- HTTP methods,
- stable vs internal designation,
- whether OpenAPI coverage is required,
- whether API inventory coverage is required,
- whether Node and/or Python SDK wrappers are required,
- namespace ownership for the canonical SDK,
- legacy compatibility expectations if applicable.

### Initial Scope

V1 should cover the most important surfaces first:

- capabilities,
- workflows,
- model strategies,
- knowledge collections,
- action runtime routes that are intentionally public or SDK-backed.

### Validator Output Examples

- route exists in code but is missing from API contract,
- API contract says route is public but generated OpenAPI does not include it,
- API contract says Node wrapper required but canonical SDK wrapper is missing,
- API contract says route is internal but public docs reference it as stable.

## Schema Contracts

### Directory

- `contracts/schema/*.json`

### Responsibility

Each schema contract declares canonical runtime requirements for a table or table group:

- required table name,
- required columns,
- expected SQL types,
- nullability/default expectations where important,
- required indexes,
- and rollout notes for backward compatibility.

### Initial Scope

V1 should start with the highest-risk runtime tables:

- `action_records`
- `capabilities`
- `workflow_templates`
- any additional tables already required by setup and runtime safety nets

### Why `action_records` Comes First

`action_records` is the broadest convergence point in DashClaw. It is consumed by:

- capabilities health/history,
- workflows,
- usage,
- drift/signals,
- replay and decision surfaces,
- learning metrics,
- and several repositories that assume modern outcome/runtime columns.

If `action_records` drifts, multiple product surfaces drift with it.

## Setup Contracts

### Directory

- `contracts/setup/*.json`

### Responsibility

Setup contracts declare what the startup/setup layer must guarantee, especially for older deployments:

- which required tables must be created or reconciled,
- which required columns must be added by `/api/setup/migrate`,
- which indexes must be reconciled or verified,
- required environment variables or setup prerequisites,
- and which failures should block CI because they would break runtime assumptions.

### Initial Scope

The first setup contract should focus on the runtime schema safety net in:

- `app/api/setup/migrate/route.js`

This validator should catch the exact class of issue that recently occurred:

- runtime code assumes a column,
- schema contract marks it required,
- setup migrator does not reconcile it,
- CI fails before deploy.

## SDK Contracts

### Directory

- `contracts/sdk/*.json`

### Responsibility

SDK contracts define canonical public surface expectations for:

- Node SDK,
- Python SDK,
- and legacy compatibility policy where still needed.

Each contract should declare:

- canonical namespaces,
- public method list,
- compatibility aliases allowed in `legacy`,
- parity expectations by method/domain,
- and ownership policy for new feature landing zones.

### Release Plan Contract

V1 also adds:

- `contracts/sdk/release-plan.json`

This file should record:

- current published Node SDK version,
- current published Python SDK version,
- next planned bump type for each when applicable (`patch`, `minor`, `major`),
- justification,
- and affected domains or public methods.

### Validator Rule

If the public SDK surface changes and `release-plan.json` was not updated in the same change, CI fails.

This does not auto-publish anything. It forces explicit release intent into the repo.

## Validator Runner

### Command

- `npm run contracts:check`

### Execution Model

The runner should:

1. load `contracts/index.json`
2. dispatch validators by enabled domain
3. aggregate findings
4. print human-readable drift errors with exact file and contract references
5. exit non-zero in CI mode when contract violations exist

Optional local mode:

- `npm run contracts:check -- --mode=warn`

### Output Shape

The validator must be direct and actionable.

Good failure example:

- `schema/action-records.json` requires `action_records.timestamp_start`
- code references found in `app/lib/capability-health.js`, `app/lib/capability-history.js`
- `/api/setup/migrate` does not reconcile this column
- fix by adding explicit column reconciliation or updating the schema contract

Bad failure example:

- `schema drift detected`

The point is not just to fail. The point is to remove ambiguity about what the developer forgot.

## Enforcement Policy

## Local

Pre-commit should warn only.

Reason:

- local development should stay fast,
- warnings help train the habit,
- but local iteration should not be blocked while the contract system is still being rolled out.

Implementation direction:

- keep current `.husky/pre-commit` generated-artifact behavior,
- append `contracts:check --mode=warn`,
- print warnings without failing the hook.

## CI

CI should hard-block.

Implementation direction:

- add `npm run contracts:check` to `.github/workflows/ci.yml`
- fail the workflow on any contract violations

This makes CI the trust boundary while keeping local development less rigid.

## Validator Domains in V1

V1 should not try to solve every drift problem at once.

Initial validator set:

1. `schema-setup`

- compare schema contract expectations against `/api/setup/migrate`
- first target: `action_records`

2. `api-surface`

- compare route contracts against actual route files
- verify whether public routes are represented in generated artifacts as required

3. `sdk-surface`

- compare canonical SDK contracts against Node/Python exported method surfaces
- verify release plan was updated when public surface changed

4. `generated-artifacts`

- validate that required generated outputs are current for declared public API surfaces
- do not broaden into prose/doc-content validation in v1

## Validator Rules

## Schema-Setup Rule

This is the highest-value rule in v1.

For each required table and field in schema contracts:

- find code references to that field in runtime code,
- confirm the schema contract includes the field,
- confirm `/api/setup/migrate` explicitly reconciles it,
- optionally confirm indexes are reconciled when marked required.

Failure cases:

- runtime uses a required field not present in schema contract,
- schema contract requires a field but setup migration does not reconcile it,
- schema contract requires an index but no setup reconciliation exists.

## API-Surface Rule

For each declared API route:

- confirm route file exists,
- confirm public routes appear in generated OpenAPI when `openapi_required` is true,
- confirm public routes appear in API inventory when `inventory_required` is true,
- confirm SDK-wrapper-required routes have the declared wrapper coverage.

Failure cases:

- contract references route not found,
- route exists but not declared,
- route declared public but missing from generated API artifacts,
- route declared SDK-backed but wrappers missing.

## SDK-Surface Rule

For each declared SDK domain:

- inspect canonical Node and Python surfaces,
- compare method signatures at the method-name level for v1,
- confirm legacy compatibility shims are present only where declared,
- detect public surface changes compared to prior baseline,
- require `release-plan.json` update when the public surface changed.

Failure cases:

- feature added to canonical Node SDK but not declared,
- API contract requires Python wrapper but Python surface missing,
- new public method appears without planned version bump update,
- new feature was added to `legacy` without a declared compatibility-only reason.

## Generated-Artifacts Rule

V1 should stay narrow here.

Checks:

- generated OpenAPI artifact current for declared public routes,
- generated API inventory current,
- optionally verify that SDK policy docs still reference canonical namespaces defined in SDK contracts.

Do not attempt to validate all narrative docs in this phase.

## Data Model Examples

The exact JSON schema can evolve during implementation, but the shape should be simple and explicit.

Example `contracts/schema/action-records.json`:

```json
{
  "table": "action_records",
  "required_columns": [
    { "name": "action_id", "type": "text" },
    { "name": "trigger", "type": "text" },
    { "name": "output_summary", "type": "text" },
    { "name": "error_message", "type": "text" },
    { "name": "timestamp_start", "type": "text" },
    { "name": "timestamp_end", "type": "text" },
    { "name": "duration_ms", "type": "integer" }
  ],
  "required_indexes": [
    { "name": "action_records_action_id_idx", "columns": ["action_id"] },
    { "name": "action_records_org_timestamp_idx", "columns": ["org_id", "timestamp_start"] }
  ],
  "setup_owner": "app/api/setup/migrate/route.js"
}
```

Example `contracts/sdk/release-plan.json`:

```json
{
  "node": {
    "current_version": "2.8.0",
    "next_bump": "minor",
    "reason": "capability runtime surface expansion",
    "domains": ["execution.capabilities"]
  },
  "python": {
    "current_version": "2.8.0",
    "next_bump": "none",
    "reason": "",
    "domains": []
  }
}
```

## Rollout Plan

## Phase 1

Lay down the framework:

- add `contracts/` directory
- add `contracts/index.json`
- add first schema, setup, and SDK release-plan contracts
- add validator runner skeleton

## Phase 2

Implement the highest-value checks:

- schema/setup reconciliation validator for `action_records`
- SDK surface change plus release-plan validator

## Phase 3

Expand public surface coverage:

- API route contract validation
- generated artifact linkage

## Phase 4

Add optional helpers after rules stabilize:

- `contracts:fix` for simple cases
- contract template generation for new route domains
- release-plan scaffolding

## Success Criteria

DashClaw should be able to catch the following before deploy:

1. A new feature reads a required column that setup migration does not reconcile.
2. A new public route is added but not declared in API contracts.
3. A route declared as SDK-backed is missing its canonical wrapper.
4. A public SDK method is added without an explicit planned version bump in-repo.
5. Generated API artifacts drift away from declared public route contracts.

## Risks

## Over-Specification

If contracts become too detailed too quickly, the system becomes expensive to maintain and developers will route around it.

Mitigation:

- start with high-signal checks only,
- avoid encoding every detail in v1,
- prefer explicit rules over inferred magic.

## Validator Fragility

If the validator is noisy or wrong, it will be ignored.

Mitigation:

- make each failure actionable,
- keep v1 scope tight,
- add unit tests for validator behavior,
- roll out incrementally by domain.

## False Confidence

If the contract is stale, the validator can “pass” while reality is wrong.

Mitigation:

- keep contracts near the code they govern conceptually,
- require contract updates as part of feature work,
- add generated artifact checks and release-plan checks so the contract cannot drift silently.

## Testing Strategy

The contract system itself should be tested like product code.

Minimum test coverage:

- unit tests for each validator domain,
- fixture-based tests for pass/fail scenarios,
- one integration-style test for the runner aggregating multiple validator findings,
- CI coverage proving `contracts:check` exits non-zero on drift.

## Out of Scope for This Spec

This spec intentionally does not define:

- the final JSON schema for every contract file,
- the future generator/autofix CLI UX,
- full SDK code generation,
- or semantic-release style publishing automation.

Those are follow-on design decisions after validator-first convergence is working.

## Recommended Next Step

Implement the validator framework first, not more runtime feature work.

Immediate first slice:

1. add `contracts/index.json`
2. add `contracts/schema/action-records.json`
3. add `contracts/sdk/release-plan.json`
4. add `scripts/check-contracts.mjs`
5. wire warning mode into pre-commit
6. wire hard-fail mode into CI
7. prove the `action_records` schema/setup drift case is caught automatically
