# DashClaw Governance Skill Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Author:** Wes + Claude

## Overview

Build a Managed Agent skill (`dashclaw-governance`) that teaches agents how to behave as governed entities. The skill provides the governance protocol, best practices, and MCP resource loading instructions so agents know when to guard, how to interpret decisions, and when to record actions — without needing verbose system prompts.

### Why

The MCP server gives agents governance *tools*. But tools without context lead to misuse — agents skip guards, forget to record, or call invoke without checking capabilities first. The skill fills this gap by teaching the agent *when and how* to use each tool correctly.

With MCP + Skill, the system prompt shrinks from a detailed governance manual to a single sentence ("You are a governed agent"), and the agent behaves better because it has internalized the protocol via progressive disclosure.

### What This Is NOT

This is not the `dashclaw-platform-intelligence` skill (which teaches *developers* how to integrate DashClaw). This skill teaches *agents* how to behave under DashClaw governance at runtime. Different audience, different content.

## Skill Structure

```
public/downloads/dashclaw-governance/
├── SKILL.md                          # Main skill instructions (~200 lines)
└── references/
    └── governance-patterns.md        # Concrete governance patterns + examples
```

Lives alongside the existing `dashclaw-platform-intelligence` skill in `public/downloads/`. Downloadable from the DashClaw instance. For Managed Agents, uploaded via `POST /v1/skills` and referenced by `skill_id`.

## SKILL.md Content

### Frontmatter

```yaml
name: dashclaw-governance
description: >
  Governance behavior for AI agents governed by DashClaw. Teaches the governance
  protocol: when to call guard (risk thresholds), how to interpret decisions
  (allow/warn/block/require_approval), when to record actions, how to wait for
  approvals, and session lifecycle management. Loads org-specific policies and
  capabilities from MCP resources at session start. Use with @dashclaw/mcp-server.
```

### Section 1: Session Initialization

Instructions for the agent to execute at session start:

1. Read `dashclaw://policies` MCP resource to understand active governance rules
2. Read `dashclaw://capabilities` MCP resource to discover available external APIs
3. Call `dashclaw_session_start` with agent ID and workspace context
4. Internalize the policy set — note which action types require approval, what risk thresholds trigger blocks

If MCP resources are unavailable (no MCP server connected), the agent should still follow the governance protocol using the static rules below. The skill degrades gracefully.

### Section 2: Governance Protocol

Decision tree for every action the agent considers:

**Risk Assessment:**
- Risk < 30 (safe): Proceed, record outcome with `dashclaw_record` after completion
- Risk 30-69 (moderate): Call `dashclaw_guard` first. Proceed only on `allow` or `warn`
- Risk 70+ (high): Call `dashclaw_guard` first. Expect `require_approval` or `block`

**Guard Decision Handling:**
- `allow` → Proceed with the action
- `warn` → Proceed with caution, record the warning context in the action record
- `block` → Stop immediately. Do NOT proceed. Report the block reason to the user
- `require_approval` → Call `dashclaw_wait_for_approval` with the action ID. Do not proceed until approved. If denied, stop and report

**External API Calls:**
- Never make direct HTTP calls to external APIs that are registered as DashClaw capabilities
- Always use `dashclaw_invoke` — it runs the full governance loop (guard + execute + record)
- Use `dashclaw_capabilities_list` to discover available capabilities before invoking

**Recording Rules:**
- Record all completed actions with `dashclaw_record` (even failures)
- Include meaningful `declared_goal` and `output_summary` — these power the audit trail in Mission Control
- Include `reasoning` for non-obvious decisions
- Include `tokens_in`, `tokens_out`, `model`, `cost_estimate` when available

### Section 3: Best Practices

Behavioral rules the agent should internalize:

1. **Guard before act** — When in doubt about risk, guard. False positives are cheap; unauthorized actions are expensive.
2. **Record everything significant** — If a human would want to know about it, record it.
3. **Discover before invoke** — Call `dashclaw_capabilities_list` before invoking an unknown capability ID.
4. **Meaningful goals** — Write `declared_goal` as if explaining to an auditor. "Deploy the app" is bad. "Deploy v2.3.1 to staging after tests passed" is good.
5. **Session lifecycle** — Call `dashclaw_session_start` at the beginning, `dashclaw_session_end` at the end. This groups all actions for tracking.
6. **Never bypass** — If `dashclaw_guard` returns `block`, do not attempt the action through another path. The policy exists for a reason.
7. **Fail loudly** — Record failed actions with `status: 'failed'` and `output_summary` explaining what went wrong. Silent failures are governance gaps.
8. **Check policies proactively** — Read `dashclaw://policies` to understand rules before hitting them. An agent that knows "deploys require approval" can set expectations with the user upfront.

## references/governance-patterns.md

Loaded on demand when the agent needs concrete examples. Contains:

### Guard-Before-Invoke Pattern
```
1. dashclaw_guard(action_type, goal, risk_score)
2. If allow/warn → dashclaw_invoke(capability_id, payload, goal)
3. dashclaw_record(action_type, goal, status, output_summary)
```

### Approval Wait Pattern
```
1. dashclaw_guard(...) → require_approval
2. dashclaw_record(action_type, goal, status='pending_approval')
3. Inform user: "This action requires approval in Mission Control"
4. dashclaw_wait_for_approval(action_id)
5. If approved → proceed and record outcome
6. If denied → record denial and inform user
```

### Session Lifecycle Pattern
```
1. dashclaw_session_start(agent_id, workspace)
2. ... governance loop (guard → act → record) ...
3. dashclaw_session_end(session_id, status='completed', summary)
```

### Multi-Step Task Pattern
```
1. dashclaw_session_start(...)
2. For each step:
   a. Assess risk
   b. Guard if risk >= 30
   c. Execute (invoke capability or perform action)
   d. Record outcome
3. dashclaw_session_end(...)
```

### Error/Failure Recording Pattern
```
1. Action fails (HTTP error, timeout, unexpected result)
2. dashclaw_record(action_type, goal, status='failed', output_summary=error_message)
3. Do NOT silently retry without recording the failure
```

## Updated Managed Agent Example

Update `examples/managed-agent-mcp/` to support the skill:

- Add `DASHCLAW_SKILL_ID` to `.env.example` (optional — MCP works without it)
- Update `main.py` to conditionally attach the skill if `DASHCLAW_SKILL_ID` is set
- Shorten the system prompt when skill is attached (skill carries the governance instructions)
- Update README with "MCP + Skill (recommended)" section

The example stays backward-compatible — MCP-only mode still works. The skill is an enhancement, not a requirement.

## Skill Upload Helper

Create `scripts/upload-skill.mjs` — a Node.js script that:
1. Reads `public/downloads/dashclaw-governance/SKILL.md` and `references/governance-patterns.md`
2. Calls `POST /v1/skills` on the Anthropic API to create/update the custom skill
3. Prints the `skill_id` for use in agent creation
4. Requires `ANTHROPIC_API_KEY` env var

This is a developer utility, not a runtime component. It's the bridge between "skill files in the repo" and "skill_id in the Managed Agent config."

## Documentation Updates

- `CHANGELOG.md` — Add governance skill entry
- `README.md` — Mention skill in Works With section
- `examples/README.md` — Update MCP example description to mention skill
- `PROJECT_DETAILS.md` — Add skill to Framework Integration Examples section

## Out of Scope

- **Skill auto-upload on deploy** — Could be a Vercel build hook, but adds complexity for minimal gain
- **Skill versioning automation** — Manual upload is fine for now
- **Dynamic skill content generation** — The skill is static content + MCP resource references. No server-side rendering of skill files.
