---
source-of-truth: true
owner: API Governance Lead
last-verified: 2026-03-14
doc-type: architecture
---

# DashClaw Project Details (v2 Governance Runtime)

DashClaw is a focused policy firewall and governance runtime for AI agent fleets. It provides the minimal infrastructure needed to intercept, govern, and verify agent actions before they reach production systems.

## Operational Maturity

### Testing (Vitest)
- **Environment**: Vitest with `jsdom`.
- **Location**: `__tests__/unit/` for unit tests.
- **Command**: `npm run test` (watch mode) or `npm run test -- --run` (CI).

### CI/CD (GitHub Actions)
Every PR to `main` must pass the **Governance Boundary Check**. DashClaw is an infrastructure primitive; new platform features are not permitted in the core runtime.

1. `npm run governance:boundary:check` — Enforces the minimal 7-route API surface.
2. `npm run openapi:check` — Detects stable API contract drift.
3. `npm run test -- --run` — Core runtime unit tests.

## Architecture (Minimal Surface)

DashClaw is organized into three distinct tiers to prevent platform bloat.

### Tier 1: Core Runtime (`app/api/` roots)
These 7 endpoints define the DashClaw category. They are mandatory for governance.

| Route | Purpose | SDK Method |
|:---|:---|:---|
| `/api/guard` | Policy evaluation | `guard()` |
| `/api/actions` | Lifecycle recording | `createAction()`, `updateOutcome()` |
| `/api/approvals` | Human review queue | `waitForApproval()` |
| `/api/assumptions` | Reasoning integrity | `recordAssumption()` |
| `/api/signals` | Anomaly detection | `getSignals()` |
| `/api/policies` | Policy management | -- |
| `/api/health` | System readiness | -- |

### Infrastructure Routes

| Route | Purpose | Schedule |
|:---|:---|:---|
| `/api/integrations/health` | Integration credential health status | On demand |
| `/api/cron/signals` | Signal detection + notification pipeline | Every 5 min |
| `/api/cron/integration-health` | Credential validation for all orgs | Every 6 hours |
| `/api/pairings` | Agent identity pairing enrollment | On demand |
| `/api/identities` | Approved agent identity management | On demand |

### Tier 2: Extensions (`app/(extensions)/`)
Modular intelligence features that consume runtime data.
- **Compliance**: Audit evidence and reporting.
- **Drift**: Detection of reasoning and metric drift.
- **Evaluations**: LLM-as-judge accuracy scoring.
- **Scoring**: Multi-dimensional risk profiles.

### Tier 3: Archived (`app/api/_archive/`)
Legacy features from the "Agent Platform" era (Messaging, CRM, Workspace, Memory Health). These are physically quarantined to maintain a small, stable runtime boundary.

## Core Libraries (`app/lib/`)

- `db.js`: Shared database connection (Neon/Postgres).
- `guard.js`: The evaluation engine for intent vs. policy.
- `signals.js`: Anomaly computation (Autonomy Spikes, Stale Actions).
- `readiness.mjs`: Instance verification for the `/setup` page.
- `org.js`: Multi-tenant scoping and role helpers.
- `integration-health.js`: Per-provider credential validation (OpenAI, Anthropic, Slack, etc).
- `notification-adapters/`: Native governance alert delivery (Slack, Discord, Linear, GitHub, Email).

## SDK Surface Area (v2)

The canonical entry point for all agents is `sdk/dashclaw.js` (exported as `dashclaw`). It has a 96% smaller surface area than the legacy SDK (`sdk/legacy/dashclaw-v1.js`).

**Methods:**
1. `guard(context)` — Intercept intent.
2. `createAction(action)` — Record start.
3. `updateOutcome(id, outcome)` — Record result.
4. `recordAssumption(assumption)` — Record reasoning basis.
5. `waitForApproval(id)` — Poll for human review.

---

## Category Enforcement
DashClaw is **Decision Infrastructure**, not an Agent Framework. We do not provide tools for agents to "work" (Calendar, Email, Chat). We provide the infrastructure to "govern" their work. 

**Rule:** If a feature helps an agent achieve a goal, it is a Platform feature (Archived). If it helps an operator govern a goal, it is a Runtime feature (Core).
