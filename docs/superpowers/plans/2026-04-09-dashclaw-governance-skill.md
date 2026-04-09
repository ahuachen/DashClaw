# DashClaw Governance Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Managed Agent skill that teaches agents the DashClaw governance protocol, best practices, and MCP resource loading — so agents know *when and how* to use governance tools correctly.

**Architecture:** A `SKILL.md` file with YAML frontmatter + markdown instructions, a `references/governance-patterns.md` file with concrete patterns, a skill upload script, and updates to the existing managed agent example to attach the skill.

**Tech Stack:** Markdown (skill content), Node.js (upload script), Python (example update)

**Spec:** `docs/superpowers/specs/2026-04-09-dashclaw-governance-skill-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `public/downloads/dashclaw-governance/SKILL.md` | Main skill — governance protocol, MCP resource loading, best practices |
| `public/downloads/dashclaw-governance/references/governance-patterns.md` | Concrete patterns with tool call sequences |
| `scripts/upload-skill.mjs` | Upload skill to Anthropic API, returns skill_id |

### Modified Files

| File | Change |
|---|---|
| `examples/managed-agent-mcp/.env.example` | Add optional DASHCLAW_SKILL_ID |
| `examples/managed-agent-mcp/main.py` | Conditionally attach skill when DASHCLAW_SKILL_ID is set |
| `examples/managed-agent-mcp/README.md` | Add MCP + Skill section |
| `CHANGELOG.md` | Add skill entry |
| `README.md` | Mention skill in Works With |
| `PROJECT_DETAILS.md` | Add skill to Framework Integration Examples |
| `examples/README.md` | Update MCP example description |

---

### Task 1: SKILL.md

**Files:**
- Create: `public/downloads/dashclaw-governance/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p public/downloads/dashclaw-governance/references
```

- [ ] **Step 2: Write SKILL.md**

```markdown
---
name: dashclaw-governance
description: >
  Governance behavior for AI agents governed by DashClaw. Teaches the governance
  protocol: when to call guard (risk thresholds), how to interpret decisions
  (allow/warn/block/require_approval), when to record actions, how to wait for
  approvals, and session lifecycle management. Loads org-specific policies and
  capabilities from MCP resources at session start. Use with @dashclaw/mcp-server.
  Trigger on: governed agent, dashclaw governance, guard policy, approval wait,
  governed capability, risk threshold, action recording, session lifecycle.
---

# DashClaw Governance Protocol

You are an agent governed by DashClaw. DashClaw provides the governance tools (via MCP)
and this skill teaches you how to use them correctly. Follow this protocol for every
action you take.

## Session Initialization

At the start of every session, do these three things:

1. **Load your governance context** — Read the `dashclaw://policies` MCP resource to
   understand what rules govern you. Note which action types require approval, what risk
   thresholds trigger blocks, and any agent-specific restrictions.

2. **Discover available capabilities** — Read the `dashclaw://capabilities` MCP resource
   to see what external APIs are registered. Note capability IDs, health status, and risk
   levels. You will use `dashclaw_invoke` (not direct HTTP) for these.

3. **Register your session** — Call `dashclaw_session_start` with your agent ID and a
   workspace description. This groups all your actions for tracking in Mission Control.

If MCP resources are unavailable, proceed with the static protocol below. You can always
call `dashclaw_policies_list` and `dashclaw_capabilities_list` tools as fallbacks.

## Governance Decision Tree

For every action you consider, assess risk and follow this protocol:

### Risk Assessment

| Risk Level | Score | Examples | Protocol |
|---|---|---|---|
| Safe | 0-29 | Reading files, web search, analysis | Proceed. Record outcome after. |
| Moderate | 30-69 | Writing files, sending messages, data queries | Guard first. Proceed on allow/warn. |
| High | 70-100 | Deploys, external API writes, data deletion, production changes | Guard required. Expect approval or block. |

### Guard Decision Handling

When you call `dashclaw_guard`, you will receive one of four decisions:

**`allow`** — Proceed with the action. No restrictions.

**`warn`** — Proceed with caution. The action is permitted but flagged. Include the
warning context in your action record (`dashclaw_record`).

**`block`** — Stop immediately. Do NOT proceed with the action. Do NOT attempt the action
through another path or tool. Report the block reason to the user. The policy exists for
a reason.

**`require_approval`** — A human must approve this action in DashClaw Mission Control.
1. Record the pending action: `dashclaw_record` with `status: 'pending_approval'`
2. Inform the user: "This action requires human approval in Mission Control."
3. Wait: call `dashclaw_wait_for_approval` with the action ID
4. If approved: proceed and record the outcome
5. If denied: stop and inform the user of the denial reason

### External API Calls

Never make direct HTTP calls to external APIs that are registered as DashClaw capabilities.
Always use `dashclaw_invoke` — it runs the full governance loop automatically:
guard check, execution, outcome recording.

Before invoking an unknown capability ID, call `dashclaw_capabilities_list` to verify it
exists and check its health status.

## Recording Rules

Record all significant actions with `dashclaw_record`. This powers the audit trail visible
in Mission Control and the Decisions ledger.

**Always record:**
- Completed actions (status: `completed`)
- Failed actions (status: `failed`) — include error details in `output_summary`
- Blocked actions (status: `failed`) — include the guard block reason

**Write meaningful fields:**
- `declared_goal` — Write as if explaining to an auditor. Bad: "Deploy the app".
  Good: "Deploy v2.3.1 to staging after all tests passed".
- `reasoning` — Why you chose this action over alternatives.
- `output_summary` — What was produced or what went wrong.
- `risk_score` — Your honest assessment. Don't lowball to avoid guards.

**When available, include:**
- `tokens_in` / `tokens_out` — Token usage for LLM operations
- `model` — Model used
- `cost_estimate` — Estimated cost in USD

## Session Lifecycle

Every governed session has a clean lifecycle:

1. `dashclaw_session_start` — Register at the beginning
2. Governance loop — Guard, act, record for each action
3. `dashclaw_session_end` — Close when done (status: `completed`, `failed`, or `cancelled`)

Include a `summary` in `dashclaw_session_end` describing what was accomplished.

## Best Practices

1. **Guard before act** — When in doubt about risk, guard. False positives are cheap.
   Unauthorized actions are expensive.

2. **Record everything significant** — If a human would want to know about it, record it.
   Silent failures are governance gaps.

3. **Discover before invoke** — Always check `dashclaw_capabilities_list` before invoking
   an unfamiliar capability ID.

4. **Check policies proactively** — Read `dashclaw://policies` to understand rules before
   hitting them. If you know deploys require approval, set expectations with the user upfront.

5. **Never bypass** — If `dashclaw_guard` returns `block`, do not attempt the action through
   another tool, workaround, or indirect path.

6. **Fail loudly** — Record failures with `status: 'failed'` and a clear `output_summary`.
   Never silently retry without recording the failure first.

7. **Be honest about risk** — Use accurate `risk_score` values. Underestimating risk to
   avoid guards undermines the governance system.

For concrete implementation patterns, see [references/governance-patterns.md](references/governance-patterns.md).
```

- [ ] **Step 3: Commit**

```bash
git add public/downloads/dashclaw-governance/SKILL.md
git commit -m "feat: add DashClaw governance skill for Managed Agents"
```

---

### Task 2: Governance Patterns Reference

**Files:**
- Create: `public/downloads/dashclaw-governance/references/governance-patterns.md`

- [ ] **Step 1: Write governance-patterns.md**

```markdown
# DashClaw Governance Patterns

Concrete tool call sequences for common governance scenarios. Load this reference when
you need implementation examples.

## Guard-Before-Invoke Pattern

The standard pattern for governed capability invocations:

```
Step 1: Guard the action
  dashclaw_guard(action_type="api_call", declared_goal="Send Slack notification",
                 risk_score=45, systems_touched=["slack"])

Step 2: Check the decision
  If "allow" or "warn" → proceed to step 3
  If "block" → stop, inform user
  If "require_approval" → go to Approval Wait Pattern

Step 3: Invoke the capability
  dashclaw_invoke(capability_id="cap_slack_notify",
                  declared_goal="Send deployment notification to #ops",
                  payload={"channel": "#ops", "message": "Deployed v2.3.1"})

Step 4: Record the outcome
  (dashclaw_invoke records automatically, but add extra context if needed)
  dashclaw_record(action_type="notification", declared_goal="Sent deploy notification",
                  status="completed", output_summary="Slack message sent to #ops")
```

## Approval Wait Pattern

When a guard decision requires human approval:

```
Step 1: Guard returns require_approval
  result = dashclaw_guard(action_type="deploy", declared_goal="Deploy to production",
                          risk_score=85, systems_touched=["production"])
  result.decision == "require_approval"

Step 2: Record the pending action
  dashclaw_record(action_type="deploy", declared_goal="Deploy v2.3.1 to production",
                  status="pending_approval", risk_score=85,
                  reasoning="All tests passed, staging verified")

Step 3: Inform the user
  "This deployment requires human approval. An operator can approve or deny
   this action in DashClaw Mission Control."

Step 4: Wait for the decision
  dashclaw_wait_for_approval(action_id="act_xxx")

Step 5: Handle the result
  If approved → proceed with the deploy, record outcome
  If denied → dashclaw_record(status="failed", output_summary="Denied by operator: [reason]")
  If timed_out → dashclaw_record(status="failed", output_summary="Approval timed out after 5 minutes")
```

## Session Lifecycle Pattern

Clean session boundaries for long-running tasks:

```
Step 1: Start session
  dashclaw_session_start(agent_id="research-agent", workspace="market-analysis")
  → session_id = "sess_xxx"

Step 2: Execute governed work
  ... (guard, act, record for each action) ...

Step 3: End session
  dashclaw_session_end(session_id="sess_xxx", status="completed",
                       summary="Analyzed 5 market segments, produced comparison report")
```

## Multi-Step Task Pattern

Governing a sequence of dependent actions:

```
Step 1: Start session
  dashclaw_session_start(agent_id="deploy-agent", workspace="release-v2.3.1")

Step 2: Guard the overall plan (low risk — just planning)
  dashclaw_guard(action_type="planning", declared_goal="Plan v2.3.1 release",
                 risk_score=10)

Step 3: Run tests (moderate risk)
  dashclaw_guard(action_type="test_execution", declared_goal="Run full test suite",
                 risk_score=35, systems_touched=["ci"])
  ... run tests ...
  dashclaw_record(action_type="test_execution", status="completed",
                  output_summary="847/847 tests passed")

Step 4: Deploy to staging (high risk)
  dashclaw_guard(action_type="deploy", declared_goal="Deploy to staging",
                 risk_score=70, systems_touched=["staging"])
  dashclaw_invoke(capability_id="cap_deploy", payload={"env": "staging"})

Step 5: Deploy to production (very high risk — expect approval)
  dashclaw_guard(action_type="deploy", declared_goal="Deploy to production",
                 risk_score=90, systems_touched=["production"])
  → require_approval → wait → approved
  dashclaw_invoke(capability_id="cap_deploy", payload={"env": "production"})

Step 6: End session
  dashclaw_session_end(session_id="sess_xxx", status="completed",
                       summary="Released v2.3.1: tests passed, staged, deployed to production")
```

## Error/Failure Recording Pattern

Always record failures — silent failures are governance gaps:

```
Step 1: Attempt the action
  result = dashclaw_invoke(capability_id="cap_api", payload={...})

Step 2: Check for failure
  If result.success == false:
    dashclaw_record(action_type="api_call", declared_goal="Fetch user data",
                    status="failed", risk_score=40,
                    output_summary="HTTP 503: Service temporarily unavailable")

Step 3: Do NOT silently retry
  If you want to retry, record the retry as a new action:
    dashclaw_guard(action_type="api_call", declared_goal="Retry: Fetch user data",
                   risk_score=40)
    dashclaw_invoke(capability_id="cap_api", payload={...})
```

## Discovery Pattern

Finding and using capabilities you haven't used before:

```
Step 1: List available capabilities
  dashclaw_capabilities_list(search="slack")
  → [{id: "cap_slack_notify", name: "Slack Notifications", health: "healthy", risk: "medium"}]

Step 2: Check the capability's health
  If health == "degraded" or "failing" → inform user, consider alternatives

Step 3: Guard the invocation
  dashclaw_guard(action_type="api_call", declared_goal="Send Slack message",
                 risk_score=45)

Step 4: Invoke
  dashclaw_invoke(capability_id="cap_slack_notify",
                  declared_goal="Notify team of completed analysis",
                  payload={"channel": "#team", "message": "Analysis complete"})
```
```

- [ ] **Step 2: Commit**

```bash
git add public/downloads/dashclaw-governance/references/governance-patterns.md
git commit -m "feat: add governance patterns reference for skill"
```

---

### Task 3: Skill Upload Script

**Files:**
- Create: `scripts/upload-skill.mjs`

- [ ] **Step 1: Write the upload script**

```javascript
#!/usr/bin/env node

/**
 * Upload the DashClaw governance skill to Anthropic's Managed Agents API.
 * Creates or updates the custom skill and prints the skill_id.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx node scripts/upload-skill.mjs
 *
 * The skill_id is used in agent creation:
 *   skills: [{ type: "custom", skill_id: "<returned_id>", version: "latest" }]
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..', 'public', 'downloads', 'dashclaw-governance');
const API_BASE = 'https://api.anthropic.com/v1';
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
  console.error('Usage: ANTHROPIC_API_KEY=sk-xxx node scripts/upload-skill.mjs');
  process.exit(1);
}

// Read skill files
const skillMd = readFileSync(resolve(SKILL_DIR, 'SKILL.md'), 'utf-8');
const patternsRef = readFileSync(resolve(SKILL_DIR, 'references', 'governance-patterns.md'), 'utf-8');

// Parse name from frontmatter
const nameMatch = skillMd.match(/^name:\s*(.+)$/m);
const skillName = nameMatch ? nameMatch[1].trim() : 'dashclaw-governance';

// Parse description from frontmatter
const descMatch = skillMd.match(/description:\s*>\s*\n([\s\S]*?)(?=^---|\n\w)/m);
const skillDescription = descMatch
  ? descMatch[1].replace(/\n\s*/g, ' ').trim()
  : 'DashClaw governance skill for Managed Agents';

console.log(`Uploading skill: ${skillName}`);
console.log(`Description: ${skillDescription.slice(0, 80)}...`);

// Create the skill
const res = await fetch(`${API_BASE}/skills`, {
  method: 'POST',
  headers: {
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'managed-agents-2026-04-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    name: skillName,
    description: skillDescription,
    content: [
      {
        type: 'file',
        filename: 'SKILL.md',
        content: skillMd,
      },
      {
        type: 'file',
        filename: 'references/governance-patterns.md',
        content: patternsRef,
      },
    ],
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`API error (${res.status}):`, err);
  process.exit(1);
}

const skill = await res.json();

console.log('\nSkill created successfully!');
console.log(`  Skill ID:  ${skill.id}`);
console.log(`  Version:   ${skill.version}`);
console.log(`  Name:      ${skill.name}`);
console.log('\nUse in agent creation:');
console.log(`  skills: [{ type: "custom", skill_id: "${skill.id}", version: "latest" }]`);
console.log('\nOr set in your .env:');
console.log(`  DASHCLAW_SKILL_ID=${skill.id}`);
```

- [ ] **Step 2: Commit**

```bash
git add scripts/upload-skill.mjs
git commit -m "feat: add skill upload script for Anthropic API"
```

---

### Task 4: Update Managed Agent Example

**Files:**
- Modify: `examples/managed-agent-mcp/.env.example`
- Modify: `examples/managed-agent-mcp/main.py`
- Modify: `examples/managed-agent-mcp/README.md`

- [ ] **Step 1: Update .env.example**

Add the optional skill ID line at the end:

```bash
# Anthropic API key for Managed Agents
ANTHROPIC_API_KEY=your_anthropic_key_here

# DashClaw instance (the MCP server runs here)
DASHCLAW_URL=http://localhost:3000
DASHCLAW_API_KEY=oc_live_your_key_here

# Optional: DashClaw governance skill (upload with: node scripts/upload-skill.mjs)
# DASHCLAW_SKILL_ID=skill_abc123
```

- [ ] **Step 2: Update main.py**

Replace the entire `main.py` with the following (adds optional skill support, shortens system prompt when skill is attached):

```python
"""
Claude Managed Agent + DashClaw MCP Governance

The simplest way to govern a Claude Managed Agent with DashClaw.
Instead of custom tools and HTTP boilerplate, the agent connects
to DashClaw's MCP server and gets 8 governance tools automatically.

Optionally attach the DashClaw governance skill for even better behavior —
the skill teaches the agent the governance protocol so you don't need
a detailed system prompt.

Requirements:
  pip install anthropic python-dotenv
  cp .env.example .env  # fill in your keys
"""

import os
import sys

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
DASHCLAW_URL = os.environ.get("DASHCLAW_URL", "http://localhost:3000")
DASHCLAW_API_KEY = os.environ.get("DASHCLAW_API_KEY", "")
DASHCLAW_SKILL_ID = os.environ.get("DASHCLAW_SKILL_ID", "")

if not ANTHROPIC_API_KEY:
    print("Error: ANTHROPIC_API_KEY is required. Set it in .env or environment.")
    sys.exit(1)


def run_governed_session(task):
    """Run a governed managed agent session via MCP."""
    client = Anthropic()

    # Build agent config
    has_skill = bool(DASHCLAW_SKILL_ID)

    # With skill: short system prompt (skill carries governance instructions)
    # Without skill: detailed system prompt
    system_prompt = (
        "You are a governed research agent."
        if has_skill
        else (
            "You are a governed research agent with DashClaw governance tools "
            "available via MCP. Before any risky action (external APIs, deploys, "
            "data modifications), call dashclaw_guard. Record significant outcomes "
            "with dashclaw_record. Use dashclaw_capabilities_list to discover "
            "available APIs."
        )
    )

    skills = []
    if has_skill:
        skills.append({
            "type": "custom",
            "skill_id": DASHCLAW_SKILL_ID,
            "version": "latest",
        })

    # 1. Create agent with DashClaw MCP server (+ optional skill)
    mode = "MCP + Skill" if has_skill else "MCP"
    print(f"Creating governed agent ({mode})...")
    agent = client.beta.agents.create(
        name=f"DashClaw Governed Agent ({mode})",
        model="claude-sonnet-4-6",
        system=system_prompt,
        tools=[{"type": "agent_toolset_20260401"}],
        mcp_servers=[
            {
                "type": "url",
                "url": f"{DASHCLAW_URL}/api/mcp",
                "headers": {"x-api-key": DASHCLAW_API_KEY},
                "name": "dashclaw",
            }
        ],
        skills=skills if skills else None,
    )
    print(f"  Agent ID: {agent.id}")

    # 2. Create environment (allow DashClaw + MCP)
    print("Creating environment...")
    environment = client.beta.environments.create(
        name="dashclaw-mcp-env",
        config={
            "type": "cloud",
            "networking": {
                "type": "limited",
                "allowed_hosts": [DASHCLAW_URL.replace("http://", "").replace("https://", "")],
                "allow_mcp_servers": True,
            },
        },
    )
    print(f"  Environment ID: {environment.id}")

    # 3. Start session
    print("Starting session...")
    session = client.beta.sessions.create(
        agent=agent.id,
        environment_id=environment.id,
        title=f"Governed ({mode}): {task[:50]}",
    )
    print(f"  Session ID: {session.id}")

    # 4. Stream — no custom tool handling needed
    print(f"\nTask: {task}")
    print("-" * 60)

    with client.beta.sessions.events.stream(session.id) as stream:
        client.beta.sessions.events.send(
            session.id,
            events=[
                {
                    "type": "user.message",
                    "content": [{"type": "text", "text": task}],
                }
            ],
        )

        for event in stream:
            match event.type:
                case "agent.message":
                    for block in event.content:
                        if hasattr(block, "text"):
                            print(block.text, end="")
                case "agent.tool_use":
                    print(f"\n  [Built-in: {event.name}]")
                case "agent.mcp_tool_use":
                    print(f"\n  [DashClaw: {event.name}]")
                case "session.status_idle":
                    stop = event.stop_reason
                    if stop and stop.type == "end_turn":
                        print("\n\nAgent finished.")
                        break
                case "session.status_terminated":
                    print("\n  [Session terminated]")
                    break
                case "session.error":
                    msg = event.error.message if hasattr(event, "error") and event.error else "unknown"
                    print(f"\n  [Error: {msg}]")

    print(f"\nGovernance trail: {DASHCLAW_URL}/decisions")

    # 5. Cleanup
    try:
        client.beta.agents.archive(agent.id)
        client.beta.environments.archive(environment.id)
    except Exception:
        pass


if __name__ == "__main__":
    task = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "Research the x402 payment protocol. Use dashclaw_guard before any "
        "external API calls. Record your findings with dashclaw_record when done."
    )
    run_governed_session(task)
```

- [ ] **Step 3: Update README.md**

Add a new section after "How It Works" and before "Setup". Read the file first to find the exact insertion point.

Add this section:

```markdown
## MCP + Skill (Recommended)

For even better governance behavior, attach the DashClaw governance skill. The skill teaches the agent the full governance protocol — when to guard, how to interpret decisions, how to record actions — so you don't need a detailed system prompt.

### Upload the skill once:

```bash
ANTHROPIC_API_KEY=sk-xxx node scripts/upload-skill.mjs
# Returns: skill_id=skill_abc123
```

### Add to your .env:

```bash
DASHCLAW_SKILL_ID=skill_abc123
```

The example automatically detects the skill ID and attaches it. The system prompt shortens to just "You are a governed research agent" — the skill carries the rest.

### Without skill vs with skill:

| | MCP Only | MCP + Skill |
|---|---|---|
| System prompt | Detailed governance instructions | One sentence |
| Agent behavior | Follows system prompt rules | Internalizes governance protocol |
| Policy awareness | Must be told about policies | Reads policies from MCP resources at start |
| Capability discovery | Must be prompted | Automatically discovers on session init |
```

- [ ] **Step 4: Commit**

```bash
git add examples/managed-agent-mcp/
git commit -m "feat: update managed agent example with optional skill support"
```

---

### Task 5: Documentation Updates

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `PROJECT_DETAILS.md`
- Modify: `examples/README.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add to the existing `## [2.12.0]` section under `### Added`:

```markdown
- **DashClaw Governance Skill**: New `dashclaw-governance` skill at `public/downloads/dashclaw-governance/` for Claude Managed Agents. Teaches agents the governance protocol (risk thresholds, guard decisions, recording rules, session lifecycle) and loads org-specific policies/capabilities from MCP resources. Upload with `node scripts/upload-skill.mjs`.
```

- [ ] **Step 2: Update README.md**

In the "Works With" section, update the Managed Agents entry to mention the skill:

Change: `Claude Managed Agents (MCP)` line
To: `Claude Managed Agents (MCP + Governance Skill)` or add the skill as a sub-bullet

Read the file first to find exact format.

- [ ] **Step 3: Update PROJECT_DETAILS.md**

Update the Framework Integration Examples paragraph to mention the skill:

Change the sentence that currently says:
`Claude Managed Agents (custom tools), and Claude Managed Agents (MCP, recommended)`
To:
`Claude Managed Agents (custom tools), Claude Managed Agents (MCP), and Claude Managed Agents (MCP + Governance Skill, recommended)`

- [ ] **Step 4: Update examples/README.md**

Update the MCP example entry to mention the skill option. Read file first for exact format.

- [ ] **Step 5: Run docs check**

```bash
npm run docs:check
npm run openapi:check
```

- [ ] **Step 6: Commit all doc changes**

```bash
git add CHANGELOG.md README.md PROJECT_DETAILS.md examples/README.md
git commit -m "docs: add governance skill to all documentation surfaces"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --run
```

Expected: All tests pass (no regressions from skill/doc changes).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

- [ ] **Step 3: Verify skill files exist and are well-formed**

```bash
cat public/downloads/dashclaw-governance/SKILL.md | head -15
cat public/downloads/dashclaw-governance/references/governance-patterns.md | head -10
node -e "import('fs').then(fs => { const s = fs.readFileSync('public/downloads/dashclaw-governance/SKILL.md','utf-8'); console.log(s.startsWith('---') ? 'Frontmatter OK' : 'MISSING FRONTMATTER'); })"
```

- [ ] **Step 4: Verify upload script runs (dry check)**

```bash
node -e "import('./scripts/upload-skill.mjs').catch(e => console.log('Expected: needs ANTHROPIC_API_KEY'))"
```

Expected: Exits with "ANTHROPIC_API_KEY environment variable is required."

- [ ] **Step 5: Push**

```bash
git push origin main
```
