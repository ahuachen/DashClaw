# Technology Stack — Adoption Milestone

**Project:** DashClaw
**Milestone:** Adoption (one-click deploy, integration guides, community)
**Researched:** 2026-03-17
**Overall confidence:** MEDIUM — Vercel deploy button confirmed from official docs skeleton; integration patterns drawn from project's existing examples and known-good framework APIs; exact vercel.json env-prompt syntax verified from official docs content.

---

## Context

DashClaw's governance runtime is feature-complete (Next.js 15, Neon Postgres, Node + Python SDK). This stack document covers only the **adoption layer**: what tooling is needed to add the deploy button, four integration guides, and a Discord community. It does not re-evaluate the core stack.

Existing core: Next.js ^16.1.6, Neon Postgres (@neondatabase/serverless ^1.0.2), Node 20, npm, Drizzle ORM, NextAuth.js, Vitest.

---

## Area 1: One-Click Vercel Deploy Button

### Recommended Approach

**Deploy button via `vercel.com/new/clone` with inline env prompts — no third-party tooling needed.**

The Vercel deploy button is a URL that opens the Vercel project creation flow pre-seeded with the repository URL and optional env var prompts. It requires:

1. A public GitHub repository (already at `github.com/ucsandman/DashClaw`)
2. A `vercel.json` in repo root (currently empty `{}`)
3. A button URL in README.md

**Confidence: MEDIUM** — Vercel docs confirmed the button exists and accepts URL query parameters including `env` and `envDescription`. The exact multi-env syntax is well-established across open-source Next.js projects (verified by pattern matching against known working examples). The vercel.json env schema does not include a deploy-button prompt mechanism — env prompts are handled entirely in the button URL, not vercel.json.

### Button URL Format

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw&env=DATABASE_URL,NEXTAUTH_SECRET,DASHCLAW_API_KEY,ENCRYPTION_KEY,CRON_SECRET,DASHCLAW_LOCAL_ADMIN_PASSWORD&envDescription=Required+env+vars+for+DashClaw&envLink=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw%2Fblob%2Fmain%2F.env.example&project-name=my-dashclaw&repository-name=my-dashclaw&demo-title=DashClaw&demo-description=AI+agent+governance+runtime&demo-url=https%3A%2F%2Fdashclaw.io
```

**Query parameters:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `repository-url` | URL-encoded GitHub repo URL | Source to clone |
| `env` | Comma-separated env var names | Prompts user to fill these in during deploy |
| `envDescription` | Human-readable hint | Shown below the env var fields |
| `envLink` | URL to docs | "Learn more" link shown to user |
| `project-name` | `my-dashclaw` (suggested default) | Pre-fills project name field |
| `repository-name` | `my-dashclaw` (suggested default) | Pre-fills forked repo name |
| `demo-title` | `DashClaw` | Display title in Vercel gallery |
| `demo-description` | Short tagline | Shown in Vercel gallery |
| `demo-url` | `https://dashclaw.io` | Demo link in gallery |

**README badge markdown:**

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw&...)
```

### vercel.json — Recommended Minimal Config

The current `vercel.json` is `{}`. For the deploy button to work well, add framework detection and cron configuration:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/health",
      "schedule": "0 * * * *"
    }
  ]
}
```

Do NOT add an `env` block to `vercel.json` — the deploy button's env prompts come from the URL query string, not from vercel.json. The `env` key in vercel.json is for overriding env var values at build time, not for prompting users during deployment.

### Neon Integration

There are two paths for database provisioning during deploy:

**Path A (Recommended): Manual — user creates Neon free account, pastes DATABASE_URL**
- Zero third-party account coupling in the deploy flow
- Consistent with DashClaw's self-hosted positioning
- Already documented in `docs/deploy-without-oauth.md`
- The `env=DATABASE_URL` prompt in the deploy button URL is sufficient
- User follows the deploy guide for Neon setup

**Path B: Neon Vercel Native Integration**
- Neon has a Vercel marketplace integration that auto-provisions a Postgres database when a project is created
- Would eliminate the manual "create Neon account" step
- Creates tighter dependency coupling — user's database is provisioned in Neon's own Vercel integration flow
- MEDIUM confidence this works smoothly — was not verifiable from primary docs during this research session
- Recommended: do NOT use for MVP. Use Path A. Add Path B as a future option after adoption traction.

### Required Env Vars to Prompt

Based on `.env.example` analysis, these are the non-optional vars to include in the `env=` query parameter (all others are optional or auto-configured):

| Env Var | Why Required | Generator Command |
|---------|-------------|-------------------|
| `DATABASE_URL` | Postgres connection string — no default | Manual (Neon console) |
| `NEXTAUTH_SECRET` | Session signing — crashes without it | `openssl rand -base64 32` |
| `DASHCLAW_API_KEY` | Agent auth — no agents work without it | `node -e "require('crypto').randomBytes(24).toString('hex')"` |
| `ENCRYPTION_KEY` | Settings encryption — must be 32 chars | `openssl rand -base64 24` |
| `CRON_SECRET` | Scheduled job auth | `openssl rand -hex 32` |
| `DASHCLAW_LOCAL_ADMIN_PASSWORD` | Login without OAuth setup | User choice |
| `NEXTAUTH_URL` | Auth callback URL — must match Vercel domain | `https://<project-name>.vercel.app` |

Note: `NEXTAUTH_URL` is a known pain point. Vercel auto-injects `VERCEL_URL` but NextAuth requires `NEXTAUTH_URL` set explicitly. The deploy button cannot pre-populate this because the domain isn't known until after the project is created. The post-deploy checklist at `/setup` already handles verification of this.

**Mitigation already exists:** `/setup` page verifies `NEXTAUTH_URL` is set and shows recovery steps. The deploy guide at `docs/deploy-without-oauth.md` instructs users to set this after deploy.

---

## Area 2: Integration Guides

### What Already Exists

The project has working examples for:
- `@openai/agents` ^0.7.0 (OpenAI Agents SDK) — `examples/openai-agents-governed/`
- `@anthropic-ai/sdk` ^0.39.0 (Claude direct SDK) — `examples/anthropic-governed-agent/`
- Python SDK (no framework, simulated actions) — `examples/python-research-agent/`
- OpenAI chat completions with tool loop — `examples/openai-governed-agent/`, `examples/openai-deploy-pipeline/`

### What's Missing

The milestone requires guides for: LangChain/LangGraph, Claude Code agents, OpenAI Agents SDK, CrewAI/AutoGen.

- **OpenAI Agents SDK** — DONE. `examples/openai-agents-governed/` is a complete working example.
- **Claude Code agents** — Partially done. `examples/anthropic-governed-agent/` covers Claude SDK. The Claude Code hook exists at `hooks/dashclaw_pretool.py`. A guide is needed, not a new example.
- **LangChain/LangGraph** — NOT DONE. No example exists. New content needed.
- **CrewAI/AutoGen** — NOT DONE. No example exists. New content needed.

### LangChain/LangGraph Integration Pattern

**Recommended: LangGraph over raw LangChain for the guide.**

LangChain (the chain abstraction) is increasingly superseded by LangGraph for agent workflows. LangGraph's node/edge model maps cleanly to the DashClaw governance loop because each node can call the governance API before/after execution.

**DashClaw hooks into LangGraph at the node boundary:**

```python
# Pattern: governance-wrapped LangGraph node
from langchain_core.tools import tool
from langgraph.graph import StateGraph
import httpx

async def governed_tool_node(state):
    # GUARD: call DashClaw before executing
    guard = httpx.post(
        f"{DASHCLAW_BASE_URL}/api/guard",
        headers={"x-api-key": DASHCLAW_API_KEY},
        json={
            "action_type": state["intent"],
            "agent_id": "langgraph-agent",
            "risk_score": state["risk_score"]
        }
    )
    if guard.json()["decision"] == "block":
        return {**state, "blocked": True}

    # EXECUTE: run the actual tool
    result = await state["tool"].invoke(state["tool_input"])

    # OUTCOME: report result
    httpx.patch(
        f"{DASHCLAW_BASE_URL}/api/actions/{state['action_id']}",
        headers={"x-api-key": DASHCLAW_API_KEY},
        json={"status": "completed", "output_summary": str(result)}
    )
    return {**state, "result": result}
```

**Package versions to use in the guide** (MEDIUM confidence — from project's existing usage patterns and training knowledge; exact versions not verified against PyPI due to tool restrictions):

| Package | Recommended Version | Why |
|---------|---------------------|-----|
| `langgraph` | `>=0.2.0` | Stable graph API; 0.2.x is the current stable series |
| `langchain-core` | `>=0.3.0` | Core abstractions; decoupled from langchain full package |
| `langchain-openai` | `>=0.2.0` | OpenAI LLM binding |
| `dashclaw` | `>=2.1.0` | Current Python SDK |
| `httpx` | `>=0.27.0` | Already used in python-research-agent |

Do NOT use `langchain` full package as the primary dependency — it pulls in too many sub-packages. Use `langgraph` + `langchain-core` + a model-specific binding (`langchain-openai`, `langchain-anthropic`).

**Guide format recommendation:** Create `examples/langgraph-governed/` matching the pattern of existing examples. Use a realistic scenario (e.g., research agent that writes a file — similar to `python-research-agent` but with LangGraph state machine driving it).

### CrewAI Integration Pattern

**Recommendation: Use CrewAI's `@tool` decorator with a DashClaw wrapper inside the tool execute function.**

CrewAI tools wrap Python functions with the `@tool` decorator. The governance call wraps the actual action inside the function body — same pattern as the OpenAI Agents SDK example.

```python
from crewai_tools import tool
from dashclaw import DashClaw

claw = DashClaw(base_url=DASHCLAW_BASE_URL, api_key=DASHCLAW_API_KEY, agent_id="crewai-agent")

@tool("delete_pii_records")
def delete_pii_records(record_ids: str, reason: str) -> str:
    """Delete records containing PII. Requires governance approval."""
    # GUARD
    decision = claw.guard(action_type="delete_pii", risk_score=80)
    if decision["decision"] == "block":
        return f"BLOCKED: {decision.get('reason')}"

    # ACTION
    action = claw.create_action(action_type="delete_pii", declared_goal=reason, risk_score=80)

    # HITL if required
    if decision["decision"] == "require_approval":
        claw.wait_for_approval(action["action_id"])

    # EXECUTE
    result = perform_deletion(record_ids)

    # OUTCOME
    claw.update_outcome(action["action_id"], status="completed", output_summary=result)
    return result
```

**AutoGen note:** AutoGen (Microsoft) uses a similar `register_function` pattern. The governance wrapper logic is identical — it's a function that calls DashClaw before/after the actual action. One guide can cover both CrewAI and AutoGen if scenarios are chosen carefully, or two separate minimal examples. Recommended: separate examples for clarity.

**Package versions:**

| Package | Recommended Version | Why |
|---------|---------------------|-----|
| `crewai` | `>=0.63.0` | Current stable; `@tool` decorator stable since 0.40.x |
| `crewai-tools` | `>=0.14.0` | Optional base tool classes |
| `dashclaw` | `>=2.1.0` | Current Python SDK |
| `pyautogen` | `>=0.4.0` | If building AutoGen example |

**Confidence: LOW** — CrewAI and AutoGen versions not verified against PyPI due to tool access restrictions. These versions are from training knowledge and may be behind current releases. Flag for version verification before writing the guides.

### Claude Code Agent Integration Pattern

Claude Code agents are governed via the existing pretool hook at `hooks/dashclaw_pretool.py`. The integration guide needs to document:

1. How to install the hook (`/hooks` in the Claude Code settings)
2. The env vars the hook reads (`DASHCLAW_BASE_URL`, `DASHCLAW_API_KEY`, `DASHCLAW_AGENT_ID`, `DASHCLAW_HOOK_MODE`, `DASHCLAW_RISK_THRESHOLD`)
3. What the hook intercepts (all tool calls above the risk threshold)
4. How to configure `guardrails.yml` for Claude Code-specific policies

No new tooling needed for this guide. It is documentation of existing functionality.

**Guide format:** A Markdown guide in `docs/guides/claude-code.md` (not a runnable example, since the hook is the integration surface, not SDK calls).

### Guide File Structure Recommendation

```
docs/guides/
├── langchain-langgraph.md     # Python. LangGraph state machine + DashClaw nodes
├── openai-agents-sdk.md       # Links to examples/openai-agents-governed/ with explanation
├── crewai.md                  # Python. CrewAI @tool decorator wrapping
├── autogen.md                 # Python. AutoGen register_function wrapping
└── claude-code.md             # Hook installation and guardrails.yml configuration

examples/
├── langgraph-governed/        # New. Python runnable example.
│   ├── agent.py
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
└── crewai-governed/           # New. Python runnable example.
    ├── agent.py
    ├── requirements.txt
    ├── .env.example
    └── README.md
```

AutoGen can share the CrewAI guide for MVP, with a code tab or note distinguishing the two. A dedicated `autogen-governed/` example is deferred unless demand appears after launch.

---

## Area 3: Discord Community Server

### Recommended Approach

**Use Discord directly. No third-party community platform tooling needed.**

Standard developer tools Discord server. No bots required at launch. No paid Discord features needed at MVP scale.

**Confidence: HIGH** — Discord community setup for developer tools is well-understood. The tooling is stable and the community pattern (channels by topic, #announcements, #help, #show-and-tell) is established.

### Server Structure (Opinionated Minimum)

| Category | Channels | Purpose |
|----------|----------|---------|
| Info | `#announcements`, `#roadmap` | Broadcasts only; read-only for members |
| Getting Started | `#welcome`, `#setup-help` | First contact; setup questions |
| Community | `#show-and-tell`, `#general` | Agent builders sharing governed agents |
| Framework | `#langchain`, `#openai-agents`, `#crewai`, `#claude-code` | Framework-specific questions |
| Dev | `#dev-updates`, `#feature-requests`, `#bugs` | Feedback loops |

Start with fewer channels and expand. Too many empty channels at launch kills momentum. Recommended MVP: 8 channels total. Add framework-specific channels only after 50+ members.

### No Bot Required at Launch

Do NOT add a welcome bot, FAQ bot, or auto-moderation bot at MVP. Complexity before traction is waste. Add when moderation burden exceeds one person's manual capacity.

**Exception:** A GitHub release bot (GitHub's built-in Discord webhook integration) is worthwhile from day one — it costs 5 minutes to set up and auto-posts new GitHub releases to `#announcements`. This reinforces the open-source credibility signal.

### Discord Invite Link

Generate a permanent invite link (not an expiring one). Embed in:
- `README.md`
- `docs/deploy-without-oauth.md`
- The `/connect` page in the app
- The Show HN post
- X/LinkedIn announcement content

---

## Summary: What This Milestone Requires to Build

| Deliverable | New Files | Dependencies | Confidence |
|-------------|-----------|--------------|------------|
| Deploy button | Update `README.md`, update `vercel.json` | None (URL-based) | MEDIUM |
| LangGraph guide + example | `examples/langgraph-governed/`, `docs/guides/langchain-langgraph.md` | `langgraph>=0.2`, `langchain-core>=0.3` | MEDIUM (versions unverified) |
| OpenAI Agents guide | `docs/guides/openai-agents-sdk.md` (points to existing example) | None (example already exists) | HIGH |
| CrewAI guide + example | `examples/crewai-governed/`, `docs/guides/crewai.md` | `crewai>=0.63.0` | LOW (versions unverified) |
| AutoGen guide | `docs/guides/autogen.md` | `pyautogen>=0.4.0` | LOW (versions unverified) |
| Claude Code guide | `docs/guides/claude-code.md` | None (hook already exists) | HIGH |
| Discord server | External setup (no repo files needed except invite link in docs) | Discord account | HIGH |

---

## What NOT to Use

| Alternative | Why Not |
|-------------|---------|
| Railway deploy button | Out of scope per PROJECT.md; Vercel-first |
| Neon Vercel Native Integration (auto-provision) | Creates cloud coupling; preserves self-hosted positioning better with manual path |
| Discourse/forums | Higher friction than Discord for developer audience |
| Discord bots at launch | Premature complexity |
| `langchain` full package (vs langgraph + langchain-core) | Heavyweight; LangGraph is the recommended agent pattern |
| AutoGen v2/AG2 rebranded package | Ecosystem is fragmenting; defer until stable |
| `vercel.json` env block for deploy prompts | Wrong mechanism; env prompts are URL query parameters, not vercel.json |

---

## Gaps Requiring Verification Before Build

1. **LangGraph, CrewAI, AutoGen package versions** — Verify against PyPI before writing requirements.txt files. Likely higher than what's listed above.
2. **NEXTAUTH_URL in deploy flow** — Test whether Vercel's deploy button allows `NEXTAUTH_URL` to be left blank and populated post-deploy, or if this breaks the first boot. The `/setup` page handles this, but the exact failure mode needs confirming.
3. **Neon Native Integration** — Verify whether the Neon Vercel marketplace integration works with the deploy button flow for a future "zero-manual-steps" path. Not required for MVP.
4. **`@openai/agents` current version** — Project uses `^0.7.0`. Verify this is still the recommended version; the OpenAI Agents SDK was in active development as of early 2025.

---

## Sources

- Vercel deploy button docs: `https://vercel.com/docs/deploy-button` (partial — JavaScript-rendered content returned skeleton only; URL parameter schema confirmed from partial content and cross-reference with vercel.json docs)
- Vercel project configuration: `https://vercel.com/docs/project-configuration/vercel-json` (full content, HIGH confidence)
- Project existing examples: `examples/openai-agents-governed/`, `examples/anthropic-governed-agent/`, `examples/python-research-agent/` (HIGH confidence — direct source)
- Project existing deploy guide: `docs/deploy-without-oauth.md` (HIGH confidence — direct source)
- Project `.env.example` — env var inventory (HIGH confidence — direct source)
- LangChain/LangGraph, CrewAI, AutoGen version numbers: training knowledge (LOW confidence — unverified)
