# DashClaw Capability Classification

This document defines the DashClaw product taxonomy. Every capability, route, and SDK method must be assigned to one of these four tiers to maintain focus on **Agent Decision Governance**.

---

## Tier 1 — Core (The Product)
**Rule:** Participates directly in the lifecycle of a governed decision (Intent → Policy → Risk → Approval → Evidence).

| Capability | SDK Golden Path | API Routes | UI Surface |
|------------|-----------------|------------|------------|
| **Policy Engine** | `guard()` | `/api/guard` | Policies |
| **Action Recording** | `createAction()` | `/api/actions` | Decisions |
| **Outcome Tracking** | `updateOutcome()` | `/api/actions/[id]` | Replay |
| **Assumption Ledger** | `recordAssumption()` | `/api/actions/assumptions` | Assumptions |
| **Approval Gating** | `requestApproval()` | `/api/actions/[id]/approve` | Approvals |
| **Risk Signals** | `emitSignal()` | `/api/actions/signals` | Signals |
| **Decision Evidence** | `getProof()` | `/api/policies/proof` | Compliance / Audit |

---

## Tier 2 — Supporting (Infrastructure)
**Rule:** Supports the operation, integration, or observability of the governance runtime.

| Capability | SDK Infrastructure | API Routes | UI Surface |
|------------|--------------------|------------|------------|
| **Agent Registry** | `registerAgent()` | `/api/agents` | Agents |
| **Fleet Presence** | `heartbeat()` | `/api/agents/[id]` | Mission Control |
| **Operational Feed** | `emitTelemetry()` | `/api/activity` | Activity |
| **Identity & Auth** | `verifySignature()` | `/api/api-keys` | API Keys / Team |
| **Usage & Billing** | `trackUsage()` | `/api/tokens` | Usage |
| **Connectivity** | -- | `/api/webhooks` | Webhooks / Integrations |

---

## Tier 3 — Experimental (Expansion)
**Rule:** Explores adjacent territory (AI safety research, labs) but is not required for decision governance.

| Capability | Focus | Status | UI Location |
|------------|-------|--------|-------------|
| **Swarm Intel** | Multi-agent communication maps | Beta | Labs (Swarm) |
| **Learning Loops** | Performance improvement over time | Research | Labs (Learning) |
| **Prompt Tracking** | Prompt versioning and version diffs | Research | Labs (Prompts) |
| **Quality Scoring** | Multi-dimensional quality metrics | Beta | Labs (Scoring) |
| **Evaluations** | LLM-as-judge scoring | Research | Labs (Evals) |
| **Task Routing** | Agent capability matchmaking | Alpha | Labs (Routing) |

---

## Tier 4 — Legacy (Archives)
**Rule:** Historical artifacts from previous product directions. Hidden from UI, deprecated in SDK.

| Capability | Status | Migration Path |
|------------|--------|----------------|
| **Goals System** | Legacy | Use Action Intent |
| **Workspace/Docs** | Legacy | Use Activity Stream |
| **Messages** | Legacy | Use Agent Handoffs |
| **Calendar** | Legacy | None |
| **Bug Hunter** | Legacy | None |

---

## The Classification Test (Decision Tree)

1. **Does it directly affect or record an agent decision?**
   - YES → **Tier 1: Core**
2. **Does it help operate or integrate DashClaw?**
   - YES → **Tier 2: Supporting**
3. **Is it exploring future platform capabilities?**
   - YES → **Tier 3: Experimental**
4. **Is it a productivity or general workspace tool?**
   - YES → **Tier 4: Legacy** (Archive)
