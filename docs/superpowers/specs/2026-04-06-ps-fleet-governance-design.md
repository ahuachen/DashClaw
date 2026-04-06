# Design Spec: DashClaw Governance for Practical Systems Agent Fleet

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Wire DashClaw governance into all 8 Practical Systems sales agents via Python SDK integration

---

## 1. Overview

Integrate DashClaw's governance runtime into Practical Systems' autonomous agent fleet. Every agent inherits governance through a modified `BaseAgent` class. The Outreach agent gets full HITL approval on email sends. All agents get guard evaluation and action recording at key decision points.

**Goal:** Produce the case study — "We govern our own 8-agent sales fleet with DashClaw."

**Approach:** SDK integration via `BaseAgent` modifications. DashClaw runs on existing Vercel deployment. PS agents call it over HTTPS. Governance is additive — existing audit logging, event emission, and locking remain untouched.

---

## 2. Architecture

```
PS Agent Fleet (Python/FastAPI on Render)
    |
    |  DashClaw Python SDK (dashclaw >= 2.10.0)
    |  guard_mode="enforce", hitl_mode per-agent
    |
    v
BaseAgent (modified)
    |
    |-- govern_guard()    -> claw.guard()            "Can I do this?"
    |-- govern_action()   -> claw.create_action()    "I'm doing this"
    |-- on decisions      -> claw.record_assumption() "I believe X"
    |-- govern_outcome()  -> claw.update_outcome()   "Here's what happened"
    |
    v
DashClaw (Vercel) <- existing deployment
    |
    |-- Guard engine evaluates 5 PS-specific policies
    |-- HITL queue for outreach email approvals
    |-- Action records for full audit trail
    |-- Mission Control dashboard shows PS fleet activity
```

**Key design decisions:**
- DashClaw SDK initializes once per agent in `BaseAgent.__init__()`
- Guard calls happen at decision points, not on every DB write
- Blocked agents skip the action and continue the cycle (no crash)
- HITL approval only on Outreach email sends
- Existing `log_action()` and `emit_event()` continue alongside DashClaw (additive)
- If DashClaw is unreachable, agents proceed ungoverned (graceful degradation)

---

## 3. BaseAgent Modifications

### 3.1 Initialization

In `BaseAgent.__init__()`, after existing setup:

```python
self.claw = None
if settings.DASHCLAW_ENABLED:
    self.claw = DashClaw(
        base_url=settings.DASHCLAW_URL,
        api_key=settings.DASHCLAW_API_KEY,
        agent_id=f"ps-{self.get_name()}",
        guard_mode="enforce",
        hitl_mode="off",
    )
    self.claw.start_heartbeat(interval=60)
```

### 3.2 Three New Helper Methods

**`govern_guard(action_type, risk_score, declared_goal, **context)`**
- Wraps `claw.guard()` in try/except
- Returns guard decision dict on success
- Returns synthetic `{"decision": "allow"}` if DashClaw disabled or unreachable
- On `GuardBlockedError`: logs block reason, emits `governance_blocked` event, returns `None`
- Timeout: 10 seconds

**`govern_action(action_type, declared_goal, **kwargs)`**
- Wraps `claw.create_action()` in try/except
- Returns `action_id` string on success
- Returns `None` if DashClaw disabled or unreachable
- Never raises into caller

**`govern_outcome(action_id, status, **kwargs)`**
- Wraps `claw.update_outcome()` in try/except
- No-op if `action_id` is `None`
- Never raises into caller

### 3.3 What Does NOT Change

- `run_cycle()` — each agent's core loop stays the same
- `log_action()` — existing audit logging stays
- `emit_event()` — existing WebSocket events stay
- `acquire_lock()` / `release_lock()` — locking is orthogonal
- Error handling — `GuardBlockedError` caught gracefully

---

## 4. Per-Agent Governance Integration

### 4.1 Outreach Agent (Medium depth, HITL on sends)

| Decision Point | Guard | HITL | Risk | Action Type |
|---|---|---|---|---|
| Start new sequence | Yes | No | 60 | `start_sequence` |
| Draft touch | No | No | -- | existing `log_action` only |
| Send email | Yes | **Yes** | 85 | `send_email` |
| Process response | No | No | -- | `process_response` (record only) |

**Send email flow:**
1. `govern_guard("send_email", 85, "Send outreach email to {contact} at {company}")`
2. If `require_approval`: `claw.create_action(status="pending_approval")` then `claw.wait_for_approval(timeout=3600)`
3. If approved: execute send, `govern_outcome(action_id, "completed")`
4. If denied: skip touch, mark rejected, `govern_outcome(action_id, "cancelled")`
5. If timeout: touch stays drafted, `govern_outcome(action_id, "failed", error_message="Approval timeout")`

### 4.2 Prospector Agent (Medium depth)

| Decision Point | Guard | HITL | Risk | Action Type |
|---|---|---|---|---|
| Promote candidate to prospect | Yes | No | 40 | `add_prospect` |
| Batch import (JSON) | Yes | No | 50 | `batch_import` |

Guard blocks promotion if context `icp_score < 30` (policy-enforced).

### 4.3 Hygiene Agent (Light depth)

| Decision Point | Guard | HITL | Risk | Action Type |
|---|---|---|---|---|
| Score batch complete | No | No | -- | `score_batch` (record only) |
| Auto-nurture to closed_lost | Yes | No | 65 | `auto_nurture` |

### 4.4 Researcher Agent (Medium depth)

| Decision Point | Guard | HITL | Risk | Action Type |
|---|---|---|---|---|
| Start research | No | No | -- | `start_research` (record only) |
| Accept constraint hypothesis | Yes | No | 45 | `accept_constraint` |
| Flag outreach ready | Yes | No | 50 | `flag_outreach_ready` |

Assumptions recorded via `claw.record_assumption()` on constraint hypothesis: "I believe {company} has constraint: {hypothesis} based on {evidence}".

### 4.5 Orchestrator Agent (Light depth)

| Decision Point | Guard | HITL | Risk | Action Type |
|---|---|---|---|---|
| Pipeline transition | No | No | -- | `pipeline_transition` (record only) |
| Cycle complete | No | No | -- | `orchestrator_cycle` (record only) |

### 4.6 Intent Tracker (Light depth)

Record only: `classify_hot_lead` when intent tier changes to "hot". No guard.

### 4.7 Meeting Intel (Light depth)

Record only: `extract_meeting_intel` with extraction summary and action items count. No guard.

### 4.8 Architect (Light depth)

Record only: `generate_architecture` with prospect name and investment estimate. No guard.

---

## 5. Starter Policy Pack

Five policies seeded into the PS organization in DashClaw:

### Policy 1: Outreach Approval Required
- **Type:** Basic threshold
- **Rule:** `action_type == "send_email"` -> `require_approval`
- **Threshold:** 0 (always triggers)
- **Scope:** `ps-outreach`

### Policy 2: Prospect Quality Gate
- **Type:** Basic with field check
- **Rule:** `action_type == "add_prospect"` AND context `icp_score < 30` -> `block`
- **Scope:** `ps-prospector`

### Policy 3: Research Budget Cap
- **Type:** Basic threshold
- **Rule:** `action_type == "start_research"` AND `cost_estimate > 0.50` -> `warn`
- **Scope:** `ps-researcher`

### Policy 4: Outreach Rate Limiter
- **Type:** Basic with signal check
- **Rule:** `ps-outreach` has > 20 `send_email` actions in 1-hour window -> `block`
- **Scope:** `ps-outreach`

### Policy 5: No Duplicate Outreach
- **Type:** Semantic (context matching)
- **Rule:** `send_email` where recipient matches active outreach sequence -> `block`
- **Scope:** `ps-outreach`

Policies live in DashClaw, tunable from dashboard without PS redeployment.

---

## 6. Configuration & Setup

### 6.1 Practical Systems Environment Variables

```
DASHCLAW_ENABLED=true
DASHCLAW_URL=https://your-dashclaw.vercel.app
DASHCLAW_API_KEY=dc_live_xxxxxxxx
DASHCLAW_ORG_ID=org_practical_systems
```

Added to `pipeline-tracker/config/settings.py` with defaults (`DASHCLAW_ENABLED=false`).

### 6.2 DashClaw One-Time Setup

Executed via `pipeline-tracker/scripts/setup_dashclaw.py` (idempotent):

1. Create organization "Practical Systems"
2. Create API key with `agent` role
3. Register 8 agent pairings: `ps-outreach`, `ps-prospector`, `ps-hygiene`, `ps-researcher`, `ps-orchestrator`, `ps-intent-tracker`, `ps-meeting-intel`, `ps-architect`
4. Seed 5 starter policies
5. Configure notification webhook to PS Mission Control WebSocket

### 6.3 Dependency

Add `dashclaw>=2.10.0` to `requirements.txt`. Zero transitive dependencies.

### 6.4 No Changes To

- DashClaw codebase (already has everything needed)
- PS database schema (governance lives in DashClaw)
- PS Mission Control frontend (initially)
- PS deployment config (just env vars)

---

## 7. Error Handling & Graceful Degradation

**Principle: DashClaw is advisory infrastructure, not a hard dependency.**

### DashClaw unreachable (Vercel down, network timeout)
- `govern_guard()` returns synthetic `{"decision": "allow"}`
- `govern_action()` and `govern_outcome()` silently fail
- Warning logged: `"DashClaw unreachable, proceeding ungoverned"`
- `emit_event()` fires `governance_degraded` event to Mission Control

### Guard returns `block`
- Agent skips that specific action, continues cycle
- Local `log_action()` records the block with reason
- `emit_event()` fires with `severity=warning`
- Agent moves to next prospect/touch/task

### HITL approval times out (1 hour for outreach)
- Touch stays in `drafted` status
- `govern_outcome(action_id, "failed", error_message="Approval timeout")`
- Next cycle picks it up again if still due

### Unexpected DashClaw error (500, malformed response)
- Same as unreachable — proceed ungoverned, log warning
- Never raises into agent's main loop

### SDK timeout
- 10 seconds per guard/action call (override SDK default of 30s)
- Sales agents run on 5-minute cycles — can't block on governance

---

## 8. Files Changed

### Practical Systems (pipeline-tracker)

| File | Change |
|---|---|
| `agents/base.py` | Add DashClaw init + 3 governance helpers (~60 lines) |
| `agents/outreach/agent.py` | Wrap 3 decision points (start_sequence, send_email, process_response) |
| `agents/prospector/agent.py` | Wrap 2 decision points (promote_candidate, batch_import) |
| `agents/hygiene/agent.py` | Wrap 2 decision points (score_batch, auto_nurture) |
| `agents/researcher/agent.py` | Wrap 3 decision points (start_research, accept_constraint, flag_outreach_ready) |
| `agents/orchestrator/agent.py` | Wrap 1 decision point (pipeline_transition, cycle_complete) |
| `agents/intent_tracker/tracker.py` | Add 1 record call (classify_hot_lead) |
| `agents/meeting_intel/workflows/post_meeting.py` | Add 1 record call (extract_meeting_intel) |
| `agents/architect/agent.py` | Add 1 record call (generate_architecture) |
| `config/settings.py` | Add 4 DASHCLAW_* env vars with defaults |
| `scripts/setup_dashclaw.py` | **New file** — one-time DashClaw org/agent/policy setup |
| `requirements.txt` | Add `dashclaw>=2.10.0` |
| `.env.example` | Add DASHCLAW_* vars |

### DashClaw

No changes.

### Estimated Scope

~400 lines of new/modified Python across 13 files. No new tables, no new services, no new infrastructure.

---

## 9. Success Criteria

- [ ] All 8 PS agents register heartbeats in DashClaw Mission Control
- [ ] Outreach email sends require and wait for HITL approval in DashClaw
- [ ] Prospect additions with ICP score < 30 are blocked by guard policy
- [ ] All governed actions appear in DashClaw's decision feed with full context
- [ ] Researcher assumptions are tracked and visible in Decision Replay
- [ ] If DashClaw is unreachable, all agents continue operating normally
- [ ] Guard call latency < 500ms p95 (10s timeout, graceful degradation)
- [ ] Zero changes to PS database schema
- [ ] Zero changes to DashClaw codebase
- [ ] Setup script is idempotent (safe to run multiple times)
