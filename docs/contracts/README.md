# Contract Validation

DashClaw uses a validator-first contract layer to catch cross-surface drift before deploy.

## Purpose

The contract system exists to stop feature work from silently drifting across:

- public API routes and methods
- runtime schema assumptions
- setup and migration safety nets
- setup scripts and readiness prerequisites
- environment and deployment prerequisites
- public SDK surface
- SDK release intent

The first shipped checks focus on `action_records` runtime schema convergence and canonical SDK surface/version planning.

## Contract Layout

- `contracts/index.json`
- `contracts/api/*.json`
- `contracts/schema/*.json`
- `contracts/setup/*.json`
- `contracts/sdk/*.json`

Each domain manifest stays intentionally small. V1 is validator-first, not generator-first.

## Commands

Run the validator directly:

```bash
npm run contracts:check
```

Warn-only mode:

```bash
npm run contracts:check:warn
```

## Enforcement

- local pre-commit: warn only
- CI: hard-block

That keeps local iteration flexible while still making repo drift a merge blocker.

## SDK Release Plan Rule

If the public SDK surface changes, you must update:

- `contracts/sdk/public-surface.json`
- `contracts/sdk/release-plan.json`

The validator treats undeclared public methods or stale release-plan versions as CI failures.

## Current V1 Scope

- declared public API route/method coverage for capabilities, workflow templates, and knowledge collections
- `action_records` schema/setup convergence
- shared setup prerequisites for migration inventory, readiness migration hints, and core tables
- shared env prerequisites for production, readiness, and self-host startup
- canonical Node SDK `execution.capabilities` surface
- canonical Python execution-studio domains for capabilities, workflows, model strategies, and knowledge
- SDK release-plan version consistency

Expand contract coverage only when the checks remain high-signal.
