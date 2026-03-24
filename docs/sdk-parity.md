---
source-of-truth: false
owner: SDK Lead
last-verified: 2026-03-18
doc-type: architecture
---

# SDK Parity Matrix (Node vs Python)

## SDK Tiers

As of v2.5.0, the Node SDK is split into two tiers:

| Tier | Entry Point | Import | Methods | Purpose |
|------|------------|--------|---------|---------|
| **v2 (Stable)** | `sdk/dashclaw.js` | `import { DashClaw } from 'dashclaw'` | 45 | Governance runtime: guard, actions, assumptions, HITL, loops, signals, scoring, messaging, handoffs, security scanning, feedback, context threads, bulk sync, learning loop |
| **v1 (Legacy)** | `sdk/legacy/dashclaw-v1.js` | `import { DashClaw } from 'dashclaw/legacy'` | 188+ | Full platform surface: everything in v2 plus swarm, SSE events, calendar, workflows, pairing, identity, preferences, and more |

**New integrations should use v2.** v1 is preserved for existing agents that depend on the full surface.

The Python SDK (`sdk-python/dashclaw/client.py`) retains the full 188+ method surface in a single module. Python parity is tracked against v1.

## v2 Stable Surface (Node)

45 public methods organized by governance concern:

| Category | Methods | Count |
|----------|---------|------:|
| Policy Enforcement | `guard` | 1 |
| Action Recording | `createAction`, `updateOutcome` | 2 |
| Assumption Tracking | `recordAssumption` | 1 |
| Human-in-the-Loop | `waitForApproval`, `approveAction`, `getPendingApprovals` | 3 |
| Agent Lifecycle | `heartbeat`, `reportConnections` | 2 |
| Loop Tracking | `registerOpenLoop`, `resolveOpenLoop` | 2 |
| Signals | `getSignals` | 1 |
| Learning Analytics | `getLearningVelocity`, `getLearningCurves`, `getLessons` | 3 |
| Prompt Registry | `renderPrompt` | 1 |
| Evaluations | `createScorer` | 1 |
| Scoring Profiles | `createScoringProfile`, `listScoringProfiles`, `getScoringProfile`, `updateScoringProfile`, `deleteScoringProfile`, `addScoringDimension`, `updateScoringDimension`, `deleteScoringDimension`, `scoreWithProfile`, `batchScoreWithProfile`, `getProfileScores`, `getProfileScoreStats`, `createRiskTemplate`, `listRiskTemplates`, `updateRiskTemplate`, `deleteRiskTemplate`, `autoCalibrate` | 17 |
| Messaging | `sendMessage`, `getInbox` | 2 |
| Handoffs | `createHandoff`, `getLatestHandoff` | 2 |
| Security Scanning | `scanPromptInjection` | 1 |
| Feedback | `submitFeedback` | 1 |
| Context Threads | `createThread`, `addThreadEntry`, `closeThread` | 3 |
| Bulk Sync | `syncState` | 1 |
| **Total** | | **45** |

Error types exported: `ApprovalDeniedError`, `GuardBlockedError`.

Constructor: `new DashClaw({ baseUrl, apiKey, agentId })`.

### Methods removed from v2 (moved to v1 only)

The following 4 methods were removed from v2 and are available only in the v1 legacy SDK:

| Method | Reason |
|--------|--------|
| `createWebhook` | Admin configuration — not part of agent runtime |
| `getActivityLogs` | Operator browsing — not part of agent runtime |
| `mapCompliance` | Quarterly admin task — not part of agent runtime |
| `getProofReport` | Auditor reporting — not part of agent runtime |

## v1 Legacy Surface (Node <-> Python Parity)

v1 parity between Node and Python is **100%** as of February 19, 2026.

- Node v1 public methods: `188+`
- Python public methods: `185+`

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
| Agent Identity (REST API) | -- | -- | Server-side only (no SDK wrapper) |
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

## v2 Changelog

### v2.6.0 (March 23, 2026)

Infrastructure routes added for agent identity enrollment and management. These routes are server-side only; SDK wrappers are provided by the existing v1 `createPairing`, `waitForPairing`, `getPairing`, and `registerIdentity` / `getIdentities` methods.

**Added infrastructure routes:**
- `POST /api/pairings` — Create pairing request
- `GET /api/pairings` — List pairings (admin)
- `GET /api/pairings/:id` — Get pairing
- `POST /api/pairings/:id/approve` — Approve pairing (admin)
- `POST /api/identities` — Register identity (admin)
- `GET /api/identities` — List identities (admin)
- `DELETE /api/identities/:agentId` — Revoke identity (admin)

### v2.5.0 (March 18, 2026)

Node SDK v2 expanded from 44 to 45 methods. Closed learning loop.

**Added:**
- Learning Analytics: `getLessons` — fetch consolidated lessons from scored outcomes
- Guard response now includes `learning` field with historical performance context

### v2.4.0 (March 18, 2026)

Node SDK v2 expanded from 38 to 44 methods. 10 methods added, 4 removed (moved to v1 only).

**Added:**
- Messaging: `sendMessage`, `getInbox`
- Handoffs: `createHandoff`, `getLatestHandoff`
- Security Scanning: `scanPromptInjection`
- Feedback: `submitFeedback`
- Context Threads: `createThread`, `addThreadEntry`, `closeThread`
- Bulk Sync: `syncState`

**Removed (moved to v1 only):**
- `createWebhook` (admin configuration)
- `getActivityLogs` (operator browsing)
- `mapCompliance` (quarterly admin task)
- `getProofReport` (auditor reporting)

### v2.3.0 (March 17, 2026)

Node SDK v2 scoring surface expanded from 1 -> 17 methods to match Python SDK parity.

Methods added: `listScoringProfiles`, `getScoringProfile`, `updateScoringProfile`, `deleteScoringProfile`, `addScoringDimension`, `updateScoringDimension`, `deleteScoringDimension`, `scoreWithProfile`, `batchScoreWithProfile`, `getProfileScores`, `getProfileScoreStats`, `createRiskTemplate`, `listRiskTemplates`, `updateRiskTemplate`, `deleteRiskTemplate`, `autoCalibrate`.

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
