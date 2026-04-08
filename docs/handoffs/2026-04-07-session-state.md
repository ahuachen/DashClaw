# DashClaw Session State

Date: 2026-04-07
Branch: `main`
Last shipped commit at handoff time: `c13f095`

## What Landed Recently

- Capability runtime hardening:
  - shared capability runtime service
  - input/output contract validation
  - capability `test`, `health`, `listHealth`, and `history` routes
  - operator-first capability detail page
- Contract validation system:
  - `npm run contracts:check`
  - schema/setup drift checks
  - API surface checks
  - startup/runtime prerequisite checks
  - env prerequisite checks
- CI startup smoke test:
  - ephemeral Postgres
  - migrate, build, boot, poll `/api/setup/status`
  - fixed process-tree teardown so CI does not hang after readiness succeeds
- Python SDK convergence for capability runtime:
  - `invoke_capability`
  - `test_capability`
  - `get_capability_health`
  - `list_capability_health`
  - `get_capability_history`
  - Python SDK surface now enforced by `contracts:check`

## Current Product Direction

DashClaw is being pushed toward:

- governed agent control plane
- capability gateway
- workflow/runtime layer
- operator cockpit
- contract-driven convergence instead of manual drift management

The current highest-leverage theme is:

- make the repo tell us when platform surfaces drift
- keep SDKs, setup, migrations, docs, and startup behavior converged

## Most Important Current Systems

### Contract validator

Primary command:

```bash
npm run contracts:check
```

Current coverage:

- API contract drift
- setup/schema drift
- setup/env drift
- Node SDK public surface
- Python SDK public surface
- SDK release-plan version consistency

### Docs validator

Primary command:

```bash
npm run docs:check
```

Important detail:

- docs validation was changed to validate tracked markdown, not the whole working tree
- this prevents local scratch folders from breaking CI

### Startup smoke

Primary CI purpose:

- prove a fresh instance can migrate, build, boot, and report configured readiness

Primary files:

- [startup-smoke.mjs](../../scripts/startup-smoke.mjs)
- [startup-smoke.mjs](../../scripts/lib/startup-smoke.mjs)
- [ci.yml](../../.github/workflows/ci.yml)

Important detail:

- it must kill the full server process group, not just the `npm` wrapper

## Where The SDK Story Stands

Canonical policy:

- Node main SDK is the primary product surface
- legacy Node SDK is compatibility-only
- Python converges by domain against the same HTTP contracts

Current converged Python domain:

- `capabilities`

Next recommended Python domains:

1. `workflows`
2. `model strategies`
3. `knowledge collections`

## Suggested Next Work

Best next implementation slice:

1. Python workflow convergence

Specifically:

- add Python contract coverage for workflow templates
- add missing Python execute method if not already present
- update release plan and parity docs

After that:

2. Python model-strategy execution convergence
3. Python knowledge-collection contract convergence

## Files That Matter Most For Next Session

- [public-surface.json](../../contracts/sdk/public-surface.json)
- [release-plan.json](../../contracts/sdk/release-plan.json)
- [check-sdk-surface.mjs](../../scripts/lib/contracts/check-sdk-surface.mjs)
- [client.py](../../sdk-python/dashclaw/client.py)
- [sdk-parity.md](../sdk-parity.md)
- [2026-04-07-sdk-migration-matrix.md](../planning/2026-04-07-sdk-migration-matrix.md)

## Commands That Should Stay Green

```bash
npm run contracts:check
npm run docs:check
```

For Python SDK convergence work:

```bash
py -3 -m unittest sdk-python.tests.test_python_capabilities_runtime
```

For JS contract coverage:

```bash
npx vitest run __tests__/unit/contracts.sdk-surface.test.js __tests__/unit/contracts.runner.test.js
```
