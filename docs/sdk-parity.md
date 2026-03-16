---
source-of-truth: false
owner: SDK Lead
last-verified: 2026-03-16
doc-type: architecture
---

# SDK Parity Matrix (Node vs Python)

## SDK Tiers

As of v2.1.5, the Node SDK is split into two tiers:

| Tier | Entry Point | Import | Methods | Purpose |
|------|------------|--------|---------|---------|
| **v2 (Stable)** | `sdk/dashclaw.js` | `import { DashClaw } from 'dashclaw'` | ~20 | Governance runtime: guard, actions, assumptions, HITL, loops, signals, scoring, compliance, webhooks |
| **v1 (Legacy)** | `sdk/legacy/dashclaw-v1.js` | `import { DashClaw } from 'dashclaw/legacy'` | 177+ | Full platform surface: everything in v2 plus swarm, SSE events, context, messaging, handoffs, pairing, identity, preferences, and more |

**New integrations should use v2.** v1 is preserved for existing agents that depend on the full surface.

The Python SDK (`sdk-python/dashclaw/client.py`) retains the full 177+ method surface in a single module. Python parity is tracked against v1.

## v2 Stable Surface (Node)

20 public methods organized by governance concern:

| Category | Methods | Count |
|----------|---------|------:|
| Policy Enforcement | `guard` | 1 |
| Action Recording | `createAction`, `updateOutcome` | 2 |
| Assumption Tracking | `recordAssumption` | 1 |
| Human-in-the-Loop | `waitForApproval` | 1 |
| Agent Lifecycle | `heartbeat`, `reportConnections` | 2 |
| Loop Tracking | `registerOpenLoop`, `resolveOpenLoop` | 2 |
| Signals | `getSignals` | 1 |
| Learning Analytics | `getLearningVelocity`, `getLearningCurves` | 2 |
| Prompt Registry | `renderPrompt` | 1 |
| Evaluations | `createScorer` | 1 |
| Scoring Profiles | `createScoringProfile` | 1 |
| Compliance | `mapCompliance`, `getProofReport` | 2 |
| Activity | `getActivityLogs` | 1 |
| Webhooks | `createWebhook` | 1 |
| **Total** | | **19** |

Error types exported: `ApprovalDeniedError`, `GuardBlockedError`.

Constructor: `new DashClaw({ baseUrl, apiKey, agentId })`.

## v1 Legacy Surface (Node ↔ Python Parity)

v1 parity between Node and Python is **100%** as of February 19, 2026.

- Node v1 public methods: `177+`
- Python public methods: `177+`

### Category Matrix (v1)

| Category | Node | Python | Status |
|---|---:|---:|---|
| Action Recording | 7 | 7 | Full parity |
| Loops & Assumptions | 7 | 7 | Full parity |
| Signals | 1 | 1 | Full parity |
| Dashboard Data | 13 | 13 | Full parity |
| Session Handoffs | 3 | 3 | Full parity |
| Context Manager | 7 | 7 | Full parity |
| Automation Snippets | 5 | 5 | Full parity |
| User Preferences | 6 | 6 | Full parity |
| Daily Digest | 1 | 1 | Full parity |
| Security Scanning | 3 | 3 | Full parity |
| Agent Messaging | 11 | 11 | Full parity |
| Behavior Guard | 2 | 2 | Full parity |
| Agent Pairing | 4 | 4 | Full parity |
| Identity Binding | 2 | 2 | Full parity |
| Organization Management | 5 | 5 | Full parity |
| Activity Logs | 1 | 1 | Full parity |
| Webhooks | 5 | 5 | Full parity |
| Bulk Sync | 1 | 1 | Full parity |
| Policy Testing | 3 | 3 | Full parity |
| Compliance Engine | 16 | 16 | Full parity |
| Task Routing | 10 | 10 | Full parity |
| Agent Schedules | 2 | 2 | Full parity |
| Evaluations | 10 | 10 | Full parity |
| User Feedback | 6 | 6 | Full parity |
| Real-Time Events | 1 | 0 | Node only |

### Cross-SDK Integration Suite

Critical-domain contract coverage is validated against a shared harness:

- Shared fixture: `docs/sdk-critical-contract-harness.json`
- Node harness runner: `scripts/check-sdk-cross-integration.mjs` (`npm run sdk:integration`)
- Python harness test: `sdk-python/tests/test_ws5_m4_integration.py` (`npm run sdk:integration:python`)

## v1 Parity Changelog

### Parity Fix (February 19, 2026)

Four methods were missing from one SDK or the other. Identified by running a normalized camelCase/snake_case diff across both SDK source files.

Node SDK additions:
- Agent Pairing: `getPairing`
- Actions/Approvals: `approveAction`, `getPendingApprovals`

Python SDK additions:
- Agent Pairing: `create_pairing_from_private_jwk`

### Full Parity Milestone (February 15, 2026)

Python SDK additions shipped to reach 100% parity across Dashboard Data, User Preferences, Daily Digest, Security Scanning, Agent Pairing, Identity Binding, Organization Management, Activity Logs.

Node SDK methods added in the same release: Identity Binding, Organization Management, Activity Logs, Webhooks.

## Version Compatibility Policy

- v2 Node SDK (`sdk/dashclaw.js`): stable governance runtime. Breaking changes require RFC + release note.
- v1 Node SDK (`sdk/legacy/dashclaw-v1.js`): legacy maintenance only. No new methods will be added.
- Python SDK (`sdk-python/dashclaw/client.py`): full surface, contract-compatible with v1 Node SDK.
- Node SDK requires Node 18+. Python SDK supports Python 3.7+.

## Notes

- Python method naming uses `snake_case`; Node uses `camelCase`.
- v2 `waitForApproval` has stricter approval validation than v1 (requires `approved_by` metadata).
- v1's `registerAssumption` was renamed to `recordAssumption` in v2.
