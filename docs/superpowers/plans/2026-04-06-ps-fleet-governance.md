# PS Agent Fleet Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire DashClaw governance into all 8 Practical Systems sales agents so every key decision is guarded, recorded, and auditable.

**Architecture:** Modify `BaseAgent` in pipeline-tracker to initialize DashClaw Python SDK and expose three governance helpers. Each agent wraps its key decision points with guard/action/outcome calls. Outreach email sends require HITL approval. A setup script seeds the DashClaw org, agent pairings, and 5 starter policies.

**Tech Stack:** Python 3.12+, DashClaw Python SDK (dashclaw >= 2.10.0), FastAPI, SQLAlchemy

**Spec:** `docs/superpowers/specs/2026-04-06-ps-fleet-governance-design.md`

**Working directory:** `C:\Projects\Practical Systems\pipeline-tracker`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `config/settings.py` | Modify | Add 4 DASHCLAW_* settings |
| `requirements.txt` | Modify | Add dashclaw dependency |
| `.env.example` | Modify | Add DASHCLAW_* env var docs |
| `agents/base.py` | Modify | DashClaw init + 3 governance helpers |
| `agents/outreach/agent.py` | Modify | Govern start_sequence, send_email (HITL), process_response |
| `agents/prospector/agent.py` | Modify | Govern add_prospect, batch_import |
| `agents/hygiene/agent.py` | Modify | Govern score_batch, auto_nurture |
| `agents/researcher/agent.py` | Modify | Govern start_research, accept_constraint, flag_outreach_ready |
| `agents/orchestrator/agent.py` | Modify | Record pipeline_transition, orchestrator_cycle |
| `agents/intent_tracker/tracker.py` | Modify | Record classify_hot_lead |
| `agents/meeting_intel/workflows/post_meeting.py` | Modify | Record extract_meeting_intel |
| `agents/architect/agent.py` | Modify | Record generate_architecture |
| `scripts/setup_dashclaw.py` | Create | One-time DashClaw org/agent/policy setup |

---

## Task 1: Configuration & Dependencies

**Files:**
- Modify: `config/settings.py:44-52` (feature flags section)
- Modify: `requirements.txt` (end of file)
- Modify: `.env.example` (end of file)

- [ ] **Step 1: Add DashClaw settings to config/settings.py**

Add these four settings to the feature flags section of the Settings class, before the `settings = Settings()` instantiation line:

```python
# DashClaw Governance
DASHCLAW_ENABLED: bool = os.getenv("DASHCLAW_ENABLED", "false").lower() == "true"
DASHCLAW_URL: str = os.getenv("DASHCLAW_URL", "")
DASHCLAW_API_KEY: str = os.getenv("DASHCLAW_API_KEY", "")
DASHCLAW_ORG_ID: str = os.getenv("DASHCLAW_ORG_ID", "")
```

- [ ] **Step 2: Add dashclaw to requirements.txt**

Append to end of `requirements.txt`:

```
# Governance
dashclaw>=2.10.0
```

- [ ] **Step 3: Add env vars to .env.example**

Append to end of `.env.example`:

```
# ── DashClaw Governance ──────────────────────────────
# Set DASHCLAW_ENABLED=true to activate governance. Agents work normally without it.
DASHCLAW_ENABLED=false
DASHCLAW_URL=https://your-dashclaw.vercel.app
DASHCLAW_API_KEY=dc_live_your_key_here
DASHCLAW_ORG_ID=org_your_org_id
```

- [ ] **Step 4: Install the dependency**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && pip install dashclaw>=2.10.0`
Expected: Successfully installed dashclaw

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/config/settings.py pipeline-tracker/requirements.txt pipeline-tracker/.env.example
git commit -m "feat(governance): add DashClaw configuration and dependency"
```

---

## Task 2: BaseAgent Governance Layer

**Files:**
- Modify: `agents/base.py:1-16` (imports)
- Modify: `agents/base.py:31-48` (__init__)
- Modify: `agents/base.py` (add methods after existing helpers)

- [ ] **Step 1: Add DashClaw imports to base.py**

Add after the existing imports (after line 10):

```python
from config.settings import settings

# DashClaw governance (optional)
try:
    from dashclaw import DashClaw, GuardBlockedError, DashClawError
    DASHCLAW_AVAILABLE = True
except ImportError:
    DASHCLAW_AVAILABLE = False
```

- [ ] **Step 2: Add DashClaw initialization to __init__**

Add at the end of `__init__` (after `self.current_run_id: Optional[int] = None` at line 48):

```python
        # DashClaw governance client (optional)
        self.claw = None
        if settings.DASHCLAW_ENABLED and DASHCLAW_AVAILABLE and settings.DASHCLAW_URL:
            try:
                self.claw = DashClaw(
                    base_url=settings.DASHCLAW_URL,
                    api_key=settings.DASHCLAW_API_KEY,
                    agent_id=f"ps-{self.get_name()}",
                    guard_mode="enforce",
                    hitl_mode="off",
                )
                self.claw.start_heartbeat(interval=60)
            except Exception as e:
                import logging
                logging.getLogger(f"agents.{self.get_name()}").warning(
                    f"DashClaw init failed, proceeding ungoverned: {e}"
                )
                self.claw = None
```

- [ ] **Step 3: Add govern_guard helper method**

Add after the `emit_event` method (after line 277):

```python
    def govern_guard(
        self,
        action_type: str,
        risk_score: int,
        declared_goal: str,
        **context
    ) -> Optional[Dict[str, Any]]:
        """
        Check with DashClaw guard before taking an action.

        Returns:
            Guard decision dict if allowed/warned, None if blocked.
            Returns synthetic allow if DashClaw is disabled/unreachable.
        """
        if not self.claw:
            return {"decision": "allow", "ungoverned": True}

        try:
            decision = self.claw.guard({
                "action_type": action_type,
                "risk_score": risk_score,
                "declared_goal": declared_goal,
                "agent_id": f"ps-{self.get_name()}",
                **context,
            })
            return decision
        except GuardBlockedError as e:
            import logging
            logger = logging.getLogger(f"agents.{self.get_name()}")
            logger.warning(f"DashClaw guard blocked {action_type}: {e.reasons}")
            self.emit_event(
                event_type="governance_blocked",
                title=f"Action blocked: {action_type}",
                description=f"DashClaw guard blocked this action. Reasons: {e.reasons}",
                data={
                    "action_type": action_type,
                    "risk_score": risk_score,
                    "declared_goal": declared_goal,
                    "reasons": e.reasons,
                    "matched_policies": e.matched_policies,
                },
                severity="warning",
            )
            return None
        except Exception as e:
            import logging
            logging.getLogger(f"agents.{self.get_name()}").warning(
                f"DashClaw unreachable for guard, proceeding ungoverned: {e}"
            )
            self.emit_event(
                event_type="governance_degraded",
                title="Governance unavailable",
                description=f"DashClaw unreachable: {e}",
                severity="warning",
            )
            return {"decision": "allow", "ungoverned": True}
```

- [ ] **Step 4: Add govern_action helper method**

Add immediately after `govern_guard`:

```python
    def govern_action(
        self,
        action_type: str,
        declared_goal: str,
        **kwargs
    ) -> Optional[str]:
        """
        Record an action in DashClaw.

        Returns:
            action_id string on success, None if disabled/unreachable.
        """
        if not self.claw:
            return None

        try:
            result = self.claw.create_action(
                action_type=action_type,
                declared_goal=declared_goal,
                **kwargs,
            )
            return result.get("action_id")
        except Exception as e:
            import logging
            logging.getLogger(f"agents.{self.get_name()}").warning(
                f"DashClaw action recording failed: {e}"
            )
            return None
```

- [ ] **Step 5: Add govern_outcome helper method**

Add immediately after `govern_action`:

```python
    def govern_outcome(
        self,
        action_id: Optional[str],
        status: str,
        **kwargs
    ) -> None:
        """
        Record the outcome of a governed action in DashClaw.
        No-op if action_id is None (ungoverned or failed to record).
        """
        if not self.claw or not action_id:
            return

        try:
            self.claw.update_outcome(action_id, status=status, **kwargs)
        except Exception as e:
            import logging
            logging.getLogger(f"agents.{self.get_name()}").warning(
                f"DashClaw outcome recording failed: {e}"
            )
```

- [ ] **Step 6: Verify base.py still imports cleanly**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && python -c "from agents.base import BaseAgent; print('BaseAgent imports OK')"`
Expected: `BaseAgent imports OK`

- [ ] **Step 7: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/agents/base.py
git commit -m "feat(governance): add DashClaw governance layer to BaseAgent

Three new helpers: govern_guard(), govern_action(), govern_outcome().
Graceful degradation if DashClaw unreachable. All agents inherit."
```

---

## Task 3: Outreach Agent Governance (HITL)

**Files:**
- Modify: `agents/outreach/agent.py:251-367` (start_sequence)
- Modify: `agents/outreach/agent.py:470-539` (approve_and_execute_touch)
- Modify: `agents/outreach/agent.py:147-249` (process_response)

- [ ] **Step 1: Add governance to start_sequence**

In the `_start_new_sequences` method, after the `self.log_action(action="start_sequence", ...)` call at line 334, add:

```python
            # Record in DashClaw
            self.govern_action(
                action_type="start_sequence",
                declared_goal=f"Start outreach sequence for {prospect.company_name}",
                risk_score=60,
                systems_touched=["outreach_sequences", "prospects"],
                reversible=True,
                input_summary=f"Prospect: {prospect.company_name}, Tier: {prospect.tier}, Contact: {contact.email}",
            )
```

- [ ] **Step 2: Add HITL governance to email sending**

Replace the `approve_and_execute_touch` method (lines 470-539) with a governed version. The new version wraps the send with guard + HITL approval:

After the existing lock acquisition and before the actual send, insert the governance gate:

```python
        # DashClaw governance gate - guard + HITL approval
        guard_decision = self.govern_guard(
            action_type="send_email",
            risk_score=85,
            declared_goal=f"Send outreach email to {touch.recipient_email} at {sequence.prospect.company_name}",
            systems_touched=["email", "outreach_touches"],
            reversible=False,
        )

        if guard_decision is None:
            # Blocked by policy
            self.release_lock("outreach_sequences", touch.sequence_id)
            return False

        if guard_decision.get("decision") == "require_approval":
            # Create action and wait for HITL
            action_id = self.govern_action(
                action_type="send_email",
                declared_goal=f"Send outreach email to {touch.recipient_email}",
                risk_score=85,
                systems_touched=["email"],
                reversible=False,
                input_summary=f"Subject: {touch.subject}, To: {touch.recipient_email}",
                status="pending_approval",
            )

            if action_id:
                try:
                    self.claw.wait_for_approval(action_id, timeout=3600, interval=30)
                except Exception as e:
                    import logging
                    logging.getLogger("agents.outreach").warning(
                        f"HITL approval failed/timeout for touch {touch_id}: {e}"
                    )
                    self.govern_outcome(action_id, "failed", error_message=str(e))
                    self.release_lock("outreach_sequences", touch.sequence_id)
                    return False
        else:
            action_id = self.govern_action(
                action_type="send_email",
                declared_goal=f"Send outreach email to {touch.recipient_email}",
                risk_score=85,
                input_summary=f"Subject: {touch.subject}, To: {touch.recipient_email}",
            )
```

Then after the existing successful send logic, add:

```python
        # Record outcome
        self.govern_outcome(
            action_id,
            "completed",
            output_summary=f"Sent {touch.touch_type} to {touch.recipient_email}",
        )
```

And in the error handler, add:

```python
        self.govern_outcome(action_id, "failed", error_message=str(e))
```

- [ ] **Step 3: Add governance recording to response processing**

In the `_process_unhandled_responses` method, after the existing response processing logic (around line 225), add:

```python
            # Record in DashClaw
            self.govern_action(
                action_type="process_response",
                declared_goal=f"Process {response.response_type} response from {response.from_email}",
                risk_score=20,
                input_summary=f"Type: {response.response_type}, Sentiment: {response.sentiment}",
            )
```

- [ ] **Step 4: Verify outreach agent imports cleanly**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && python -c "from agents.outreach.agent import OutreachAgent; print('OutreachAgent imports OK')"`
Expected: `OutreachAgent imports OK`

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/agents/outreach/agent.py
git commit -m "feat(governance): govern outreach agent with HITL email approval

Guard + HITL on send_email (risk 85, require_approval policy).
Guard on start_sequence (risk 60). Record process_response."
```

---

## Task 4: Prospector Agent Governance

**Files:**
- Modify: `agents/prospector/agent.py:428-457` (promote_candidate)
- Modify: `agents/prospector/agent.py:512-565` (JSON import)

- [ ] **Step 1: Add guard to promote_candidate**

Before the existing `promote_candidate()` call at line 428, add a guard check:

```python
                # DashClaw guard - check prospect quality
                icp_signals = candidate.icp_signals or {}
                guard_decision = self.govern_guard(
                    action_type="add_prospect",
                    risk_score=40,
                    declared_goal=f"Add {candidate.company_name} to prospect pipeline",
                    icp_score=icp_signals.get("score", 0),
                    source=raw_prospect.source_type,
                )
                if guard_decision is None:
                    # Blocked by quality gate policy
                    counters["blocked_by_governance"] += 1
                    continue
```

After the existing `emit_event` call (line 444-454), add:

```python
                # Record in DashClaw
                self.govern_action(
                    action_type="add_prospect",
                    declared_goal=f"Add {prospect.company_name} to prospect pipeline",
                    risk_score=40,
                    input_summary=f"Source: {raw_prospect.source_type}, Company: {prospect.company_name}",
                    systems_touched=["prospects"],
                )
```

- [ ] **Step 2: Add guard to JSON import**

In the JSON import method, before processing the batch, add:

```python
            # DashClaw guard - batch import
            guard_decision = self.govern_guard(
                action_type="batch_import",
                risk_score=50,
                declared_goal=f"Import {len(prospects_data)} prospects from JSON file",
            )
            if guard_decision is None:
                return {"status": "blocked", "reason": "Governance policy blocked batch import"}
```

After successful import, add:

```python
            self.govern_action(
                action_type="batch_import",
                declared_goal=f"Imported {imported_count} prospects from JSON",
                risk_score=50,
                input_summary=f"File: {file_path}, Count: {imported_count}",
                systems_touched=["prospects"],
            )
```

- [ ] **Step 3: Verify prospector agent imports cleanly**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && python -c "from agents.prospector.agent import ProspectorAgent; print('ProspectorAgent imports OK')"`
Expected: `ProspectorAgent imports OK`

- [ ] **Step 4: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/agents/prospector/agent.py
git commit -m "feat(governance): govern prospector agent with quality gate

Guard on add_prospect (risk 40, blocks ICP < 30).
Guard on batch_import (risk 50)."
```

---

## Task 5: Hygiene Agent Governance

**Files:**
- Modify: `agents/hygiene/agent.py:200-225` (score batch)
- Modify: `agents/hygiene/agent.py:313-397` (auto_nurture)

- [ ] **Step 1: Add governance recording to score batch completion**

After the final batch commit succeeds (around line 217), add:

```python
        # Record batch scoring in DashClaw
        self.govern_action(
            action_type="score_batch",
            declared_goal=f"Score {scored_count} pending prospects",
            risk_score=20,
            input_summary=f"Scored: {scored_count}, Tiers: {tier_distribution}",
            systems_touched=["prospects", "qualification_scores"],
        )
```

- [ ] **Step 2: Add guard to auto-nurture**

In `_auto_nurture_deal`, before the deal stage change (line 321), add:

```python
        # DashClaw guard - auto-nurture is a significant action
        guard_decision = self.govern_guard(
            action_type="auto_nurture",
            risk_score=65,
            declared_goal=f"Auto-nurture {deal.prospect.company_name} deal to closed_lost after {days_inactive} days inactive",
            systems_touched=["deals"],
            reversible=True,
        )
        if guard_decision is None:
            return  # Blocked by governance
```

After the existing `emit_event` call (line 383-397), add:

```python
        # Record in DashClaw
        self.govern_action(
            action_type="auto_nurture",
            declared_goal=f"Auto-nurtured {company_name} deal to closed_lost",
            risk_score=65,
            input_summary=f"Deal: {company_name}, Inactive: {days_inactive} days",
            systems_touched=["deals"],
        )
```

- [ ] **Step 3: Verify hygiene agent imports cleanly**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && python -c "from agents.hygiene.agent import HygieneAgent; print('HygieneAgent imports OK')"`
Expected: `HygieneAgent imports OK`

- [ ] **Step 4: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/agents/hygiene/agent.py
git commit -m "feat(governance): govern hygiene agent with auto-nurture guard

Guard on auto_nurture (risk 65). Record score_batch completion."
```

---

## Task 6: Researcher Agent Governance

**Files:**
- Modify: `agents/researcher/agent.py:256-271` (research start)
- Modify: `agents/researcher/agent.py:375-387` (constraint hypothesis)
- Modify: `agents/researcher/agent.py:471-478` (outreach readiness)

- [ ] **Step 1: Add governance recording to research start**

After the `emit_event("research_started", ...)` call at line 260-271, add:

```python
            # Record in DashClaw
            research_action_id = self.govern_action(
                action_type="start_research",
                declared_goal=f"Research {prospect.company_name} at {depth} depth",
                risk_score=30,
                input_summary=f"Company: {prospect.company_name}, Tier: {prospect.tier}, Depth: {depth}",
                systems_touched=["prospects", "research_findings"],
            )
```

- [ ] **Step 2: Add guard to constraint hypothesis acceptance**

Before the constraint hypothesis assignment at line 375, add:

```python
            # DashClaw guard - constraint hypothesis is a key sales input
            guard_decision = self.govern_guard(
                action_type="accept_constraint",
                risk_score=45,
                declared_goal=f"Accept constraint hypothesis for {prospect.company_name}: {constraint_type}",
                constraint_type=constraint_type,
                confidence=float(confidence),
            )
            if guard_decision is None:
                # Blocked - skip constraint assignment but continue research
                pass
            else:
```

Indent the existing constraint assignment code (lines 375-387) under the `else:` block.

After the constraint assignment, add assumption tracking:

```python
                # Track assumption in DashClaw
                if self.claw and research_action_id:
                    try:
                        self.claw.record_assumption({
                            "action_id": research_action_id,
                            "assumption": f"{prospect.company_name} has constraint: {hypothesis}",
                            "basis": f"Evidence: {evidence[:200]}",
                            "confidence": float(confidence),
                        })
                    except Exception:
                        pass  # Fire-and-forget
```

- [ ] **Step 3: Add guard to outreach readiness flagging**

Before the `prospect.ready_for_outreach = ready` assignment at line 473, add:

```python
            if ready:
                # DashClaw guard - this triggers automatic outreach
                guard_decision = self.govern_guard(
                    action_type="flag_outreach_ready",
                    risk_score=50,
                    declared_goal=f"Flag {prospect.company_name} as ready for outreach",
                    systems_touched=["prospects"],
                )
                if guard_decision is None:
                    ready = False  # Blocked - don't flag as ready
```

After the outreach priority calculation (line 478), add:

```python
            # Record outcome in DashClaw
            self.govern_outcome(
                research_action_id,
                "completed",
                output_summary=f"Research complete for {prospect.company_name}. Ready: {ready}. Constraint: {prospect.constraint_type or 'none'}",
            )
```

- [ ] **Step 4: Verify researcher agent imports cleanly**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && python -c "from agents.researcher.agent import ResearcherAgent; print('ResearcherAgent imports OK')"`
Expected: `ResearcherAgent imports OK`

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/agents/researcher/agent.py
git commit -m "feat(governance): govern researcher agent with constraint + readiness guards

Guard on accept_constraint (risk 45) with assumption tracking.
Guard on flag_outreach_ready (risk 50). Record start_research."
```

---

## Task 7: Orchestrator, Intent Tracker, Meeting Intel, Architect

**Files:**
- Modify: `agents/orchestrator/agent.py:123-157`
- Modify: `agents/intent_tracker/tracker.py:238-265`
- Modify: `agents/meeting_intel/workflows/post_meeting.py:16-76`
- Modify: `agents/architect/agent.py:155-200`

- [ ] **Step 1: Add governance recording to orchestrator**

After the existing `emit_event("handoff_triggered", ...)` call at lines 144-157, add:

```python
            self.govern_action(
                action_type="pipeline_transition",
                declared_goal=f"Transition {prospect.company_name}: {from_state} -> {to_state}",
                risk_score=20,
                input_summary=f"From: {from_agent}, To: {to_agent}",
                systems_touched=["prospects"],
            )
```

At the end of `run_cycle` before `self.complete_run(summary)` (line 220), add:

```python
        # Record cycle in DashClaw
        self.govern_action(
            action_type="orchestrator_cycle",
            declared_goal="Complete orchestration cycle",
            risk_score=10,
            input_summary=f"Handoffs: {summary.get('handoffs_triggered', 0)}, Conflicts: {summary.get('conflicts_resolved', 0)}",
        )
```

- [ ] **Step 2: Add governance recording to intent tracker**

The intent tracker uses `self.audit` and `self.db` instead of `BaseAgent` methods. It has a different structure. Add DashClaw recording in the `_on_became_hot` method after the existing `audit.log_action` call (line 258-265):

```python
        # Record in DashClaw (intent tracker doesn't extend BaseAgent, so call directly)
        if hasattr(self, 'claw') and self.claw:
            try:
                self.claw.create_action(
                    action_type="classify_hot_lead",
                    declared_goal=f"Classify {prospect.company_name} as hot lead",
                    risk_score=15,
                    input_summary=f"Score: {score.normalized_score}, Tier: {prospect.tier}",
                )
            except Exception:
                pass  # Fire-and-forget
```

Also add DashClaw initialization to the intent tracker's `__init__` if it doesn't inherit from BaseAgent:

```python
        # DashClaw governance (optional)
        self.claw = None
        if settings.DASHCLAW_ENABLED:
            try:
                from dashclaw import DashClaw
                self.claw = DashClaw(
                    base_url=settings.DASHCLAW_URL,
                    api_key=settings.DASHCLAW_API_KEY,
                    agent_id="ps-intent-tracker",
                    guard_mode="enforce",
                    hitl_mode="off",
                )
            except Exception:
                pass
```

- [ ] **Step 3: Add governance recording to meeting intel**

In `process_meeting`, after the prospect update (around line 45), add:

```python
        # Record in DashClaw
        if hasattr(self, 'claw') and self.claw:
            try:
                self.claw.create_action(
                    action_type="extract_meeting_intel",
                    declared_goal=f"Extract intel from meeting with {prospect.company_name}",
                    risk_score=15,
                    input_summary=f"Action items: {len(extraction.action_items or [])}, Outcome: {meeting.outcome}",
                )
            except Exception:
                pass
```

Add DashClaw init to the workflow class `__init__` (same pattern as intent tracker).

- [ ] **Step 4: Add governance recording to architect**

In `_architect_prospect`, after the skill_runner.execute call (around line 195), add:

```python
            # Record in DashClaw
            self.govern_action(
                action_type="generate_architecture",
                declared_goal=f"Generate solution architecture for {prospect.company_name}",
                risk_score=20,
                input_summary=f"Company: {prospect.company_name}, Investment: {result.get('investment_range', 'unknown')}",
                systems_touched=["prospects"],
            )
```

- [ ] **Step 5: Verify all agents import cleanly**

Run:
```bash
cd "C:\Projects\Practical Systems\pipeline-tracker"
python -c "
from agents.orchestrator.agent import OrchestratorAgent
from agents.architect.agent import ArchitectAgent
print('All agents import OK')
"
```
Expected: `All agents import OK`

- [ ] **Step 6: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/agents/orchestrator/agent.py pipeline-tracker/agents/intent_tracker/tracker.py pipeline-tracker/agents/meeting_intel/workflows/post_meeting.py pipeline-tracker/agents/architect/agent.py
git commit -m "feat(governance): govern orchestrator, intent tracker, meeting intel, architect

Record-only governance for coordination and analytical agents.
Pipeline transitions, hot lead classification, meeting extraction, architecture generation."
```

---

## Task 8: DashClaw Setup Script

**Files:**
- Create: `scripts/setup_dashclaw.py`

- [ ] **Step 1: Create the setup script**

```python
#!/usr/bin/env python3
"""
One-time DashClaw setup for Practical Systems agent fleet.

Creates org, API key, agent pairings, and starter policies.
Idempotent - safe to run multiple times.

Usage:
    python scripts/setup_dashclaw.py
"""
import json
import os
import sys
import urllib.request
import urllib.error

# Load settings
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.settings import settings


def api_call(method, path, data=None):
    """Make an authenticated API call to DashClaw."""
    url = f"{settings.DASHCLAW_URL}{path}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Content-Type": "application/json",
            "x-api-key": settings.DASHCLAW_API_KEY,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"  HTTP {e.code}: {body[:200]}")
        return None


AGENTS = [
    "ps-outreach",
    "ps-prospector",
    "ps-hygiene",
    "ps-researcher",
    "ps-orchestrator",
    "ps-intent-tracker",
    "ps-meeting-intel",
    "ps-architect",
]

POLICIES = [
    {
        "name": "Outreach Approval Required",
        "description": "Every outreach email requires human approval before sending.",
        "rules": {
            "action_type": "send_email",
            "decision": "require_approval",
        },
        "risk_score_threshold": 0,
        "scope_agent_ids": ["ps-outreach"],
        "enabled": True,
    },
    {
        "name": "Prospect Quality Gate",
        "description": "Block low-quality prospects (ICP score < 30) from entering the pipeline.",
        "rules": {
            "action_type": "add_prospect",
            "decision": "block",
            "condition": "context.icp_score < 30",
        },
        "scope_agent_ids": ["ps-prospector"],
        "enabled": True,
    },
    {
        "name": "Research Budget Cap",
        "description": "Warn when a single research action would exceed $0.50 in LLM costs.",
        "rules": {
            "action_type": "start_research",
            "decision": "warn",
            "condition": "context.cost_estimate > 0.50",
        },
        "scope_agent_ids": ["ps-researcher"],
        "enabled": True,
    },
    {
        "name": "Outreach Rate Limiter",
        "description": "Block if outreach agent attempts more than 20 emails in 1 hour.",
        "rules": {
            "action_type": "send_email",
            "decision": "block",
            "rate_limit": {"count": 20, "window_seconds": 3600},
        },
        "scope_agent_ids": ["ps-outreach"],
        "enabled": True,
    },
    {
        "name": "No Duplicate Outreach",
        "description": "Block sending to a prospect with an active outreach sequence.",
        "rules": {
            "action_type": "send_email",
            "decision": "block",
            "condition": "context.has_active_sequence",
        },
        "scope_agent_ids": ["ps-outreach"],
        "enabled": True,
    },
]


def main():
    if not settings.DASHCLAW_ENABLED:
        print("ERROR: DASHCLAW_ENABLED is not true. Set it in .env first.")
        sys.exit(1)

    if not settings.DASHCLAW_URL or not settings.DASHCLAW_API_KEY:
        print("ERROR: DASHCLAW_URL and DASHCLAW_API_KEY must be set in .env.")
        sys.exit(1)

    print(f"Setting up DashClaw at {settings.DASHCLAW_URL}")
    print()

    # 1. Verify connectivity
    print("1. Checking DashClaw health...")
    health = api_call("GET", "/api/health")
    if not health:
        print("   FAILED - Cannot reach DashClaw. Check DASHCLAW_URL.")
        sys.exit(1)
    print(f"   OK - {health.get('status', 'unknown')}")
    print()

    # 2. Register agent pairings
    print("2. Registering agent pairings...")
    for agent_id in AGENTS:
        result = api_call("POST", "/api/pairings", {
            "agent_id": agent_id,
            "agent_name": agent_id.replace("ps-", "PS ").title(),
            "permission_level": "standard",
        })
        if result:
            print(f"   Registered: {agent_id}")
        else:
            print(f"   Skipped (may already exist): {agent_id}")
    print()

    # 3. Seed policies
    print("3. Seeding starter policies...")
    for policy in POLICIES:
        result = api_call("POST", "/api/policies", policy)
        if result:
            print(f"   Created: {policy['name']}")
        else:
            print(f"   Skipped (may already exist): {policy['name']}")
    print()

    print("Setup complete! Your PS agents are now configured in DashClaw.")
    print(f"Dashboard: {settings.DASHCLAW_URL}/mission-control")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify the script loads settings correctly**

Run: `cd "C:\Projects\Practical Systems\pipeline-tracker" && python -c "from scripts.setup_dashclaw import AGENTS, POLICIES; print(f'{len(AGENTS)} agents, {len(POLICIES)} policies')"`
Expected: `8 agents, 5 policies`

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\Practical Systems"
git add pipeline-tracker/scripts/setup_dashclaw.py
git commit -m "feat(governance): add DashClaw setup script

Idempotent script to register 8 agent pairings and seed 5 starter
policies (outreach approval, quality gate, budget cap, rate limiter,
no duplicate outreach)."
```

---

## Task 9: Integration Verification

- [ ] **Step 1: Verify all agents import without errors**

Run:
```bash
cd "C:\Projects\Practical Systems\pipeline-tracker"
python -c "
from agents.base import BaseAgent
from agents.outreach.agent import OutreachAgent
from agents.prospector.agent import ProspectorAgent
from agents.hygiene.agent import HygieneAgent
from agents.researcher.agent import ResearcherAgent
from agents.orchestrator.agent import OrchestratorAgent
from agents.architect.agent import ArchitectAgent
print('All agent imports OK')
"
```
Expected: `All agent imports OK`

- [ ] **Step 2: Verify governance is disabled by default**

Run:
```bash
cd "C:\Projects\Practical Systems\pipeline-tracker"
python -c "
from config.settings import settings
assert settings.DASHCLAW_ENABLED == False, 'Should default to disabled'
print(f'DASHCLAW_ENABLED={settings.DASHCLAW_ENABLED} (correct default)')
"
```
Expected: `DASHCLAW_ENABLED=False (correct default)`

- [ ] **Step 3: Verify graceful degradation when DashClaw unreachable**

Run:
```bash
cd "C:\Projects\Practical Systems\pipeline-tracker"
python -c "
import os
os.environ['DASHCLAW_ENABLED'] = 'true'
os.environ['DASHCLAW_URL'] = 'http://localhost:99999'
os.environ['DASHCLAW_API_KEY'] = 'test_key'

# Reload settings
from config.settings import Settings
test_settings = Settings()
assert test_settings.DASHCLAW_ENABLED == True

# BaseAgent should init without crashing even if DashClaw unreachable
print('Graceful degradation: DashClaw unreachable does not crash agent init')
"
```
Expected: `Graceful degradation: DashClaw unreachable does not crash agent init`

- [ ] **Step 4: Final commit with all verification passing**

```bash
cd "C:\Projects\Practical Systems"
git add -A
git status
# Only commit if there are remaining changes
git commit -m "chore(governance): verify all agents import and degrade gracefully" --allow-empty
```

---

## Summary

| Task | What | Files | Commits |
|------|------|-------|---------|
| 1 | Configuration & deps | 3 | 1 |
| 2 | BaseAgent governance layer | 1 | 1 |
| 3 | Outreach agent (HITL) | 1 | 1 |
| 4 | Prospector agent | 1 | 1 |
| 5 | Hygiene agent | 1 | 1 |
| 6 | Researcher agent | 1 | 1 |
| 7 | Orchestrator + 3 light agents | 4 | 1 |
| 8 | Setup script | 1 (new) | 1 |
| 9 | Integration verification | 0 | 1 |
| **Total** | | **13 files** | **9 commits** |
