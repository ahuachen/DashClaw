---
source-of-truth: false
owner: SDK Lead
last-verified: 2026-02-14
doc-type: release-note
---

# Release Notes: Platform Convergence Closeout (February 14, 2026)

## Scope

- WS1: Data access convergence (repository boundaries + SQL guardrail)
- WS2: API contract governance (OpenAPI + maturity inventory + drift gates)
- WS3: Realtime reliability (broker-backed SSE + replay/cutover controls)
- WS4: Documentation governance (metadata + canonical hierarchy + CI checks)
- WS5: SDK parity milestones M2-M4 (critical domain parity + cross-SDK integration suite)

## Operational Changes

- Route-level direct SQL growth is now blocked by CI (`npm run route-sql:check`).
- Stable API contract drift is now blocked by CI (`npm run openapi:check`).
- API maturity inventory drift is now blocked by CI (`npm run api:inventory:check`).
- Docs governance checks are now required in CI (`npm run docs:check`).
- Cross-SDK critical-domain parity checks are now required in CI (`npm run sdk:integration`).

## SDK Migration Guidance

- Node + Python critical domains are now validated through a shared harness:
  - actions, guard, context threads, memory reporting, messaging lifecycle, sync.
- Python SDK now supports:
  - approvals/webhooks (WS5 M2),
  - context thread lifecycle + messaging parity methods + flexible memory payload input (WS5 M3).
- No forced constructor or auth-surface migration was introduced in this closeout.

## Compatibility Notes

- Node SDK runtime floor remains Node 18+.
- Python SDK support floor remains Python 3.7+.
- Method naming remains language-native:
  - Node: camelCase
  - Python: snake_case

## Breaking-Change Process

- Stable API contract breaking changes require RFC-tagged approval (see `docs/openapi/README.md`).
- For SDK critical-domain contract changes:
  - update the shared integration harness,
  - update `docs/sdk-parity.md`,
  - publish corresponding release note guidance.
