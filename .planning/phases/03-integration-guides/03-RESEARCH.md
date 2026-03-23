# Phase 3: Integration Guides - Research

**Researched:** 2026-03-23
**Domain:** Developer documentation — JSX guide pages, Python example scripts, framework integration patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Guide format**
- D-01: In-app JSX pages under `app/guides/` matching /connect's dark theme pattern (`bg-[#0a0a0a]`, PublicNavbar, PublicFooter)
- D-02: 5-7 steps per guide: Deploy → Install SDK → Set env vars → Write guard call → Run → See result in dashboard
- D-03: Each guide has its own inline guardrails.yml policy example showing governance-as-code in that framework's context — not a shared example
- D-04: Code blocks with copy-paste support and live host URL injection (same pattern as /connect's `ConnectGuideClient`)

**Proof moment**
- D-05: Same proof moment for all 4 guides: "Go to /decisions — you should see your action in the ledger" with a text description of the expected row (action_type, status)
- D-06: No screenshots — text description only. No images to maintain.

**Python examples**
- D-07: Minimal but real — single-file script, one agent, one governed action. Runs in under 30 seconds. Uses real SDK calls, not mocks.
- D-08: Use the DashClaw Python SDK (`dashclaw-python` from `sdk-python/`), not raw HTTP calls
- D-09: Two new example directories: `examples/langgraph-governed/` and `examples/crewai-governed/` with pinned dependency versions in requirements.txt

**Navigation wiring**
- D-10: Add a "Framework Guides" section to /connect with 4 cards linking to /guides/claude-code, /guides/openai-agents-sdk, /guides/langgraph, /guides/crewai
- D-11: README links to /connect (one link), not to individual guides. /connect cards handle framework selection.
- D-12: /self-host page also gets guide links (same 4-card pattern or simple link list)

### Claude's Discretion
- Exact step content and code snippets per guide
- Card layout and styling on /connect
- Whether to create a shared GuideLayout component or keep each page self-contained
- Order of guides on the /connect cards
- guardrails.yml content per framework (as long as it demonstrates governance-as-code)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GUIDE-01 | Official Claude Code integration guide covering pretool hook setup, env var configuration, and guardrails.yml policy example | Hooks files verified at `hooks/dashclaw_pretool.py`, `hooks/settings.json`; SKILL.md "Claude Code Hooks" workflow documents full setup |
| GUIDE-02 | Official OpenAI Agents SDK integration guide linked to `examples/openai-agents-governed/` with annotated walkthrough | Full working example verified at `examples/openai-agents-governed/index.js`; uses `@openai/agents@^0.7.0` |
| GUIDE-03 | LangChain/LangGraph integration guide with new runnable Python example (`examples/langgraph-governed/`) covering guard + createAction + updateOutcome in a graph node | langgraph 1.1.3 verified on PyPI; `DashClawCallbackHandler` exists in `sdk-python/dashclaw/integrations/langchain.py` |
| GUIDE-04 | CrewAI integration guide with new runnable Python example (`examples/crewai-governed/`) using `@tool` decorator pattern | crewai 1.11.0 verified on PyPI; `DashClawCrewIntegration` exists in `sdk-python/dashclaw/integrations/crewai.py` |
| GUIDE-05 | All 4 guides follow conversion-guide structure: deploy button as step 1, sub-20-minute completion target, ends with visible proof moment | /connect page structure + ConnectGuideClient component analyzed; proof moment pattern established |
| GUIDE-06 | All 4 guides are navigable from README, `/connect`, and `/self-host` pages | README, app/connect/page.js, app/self-host/page.js inspected; all need guide-card additions |
</phase_requirements>

---

## Summary

This phase builds four framework-specific integration guide pages in Next.js JSX and two new Python example scripts. All content is static and self-contained — no new API routes, no database changes, and no new SDK methods are needed. The core platform work was done in Phases 1–2; this phase is entirely developer experience (DX).

The critical pre-work is already in the repo. The existing `/connect` page (`app/connect/page.js` + `ConnectGuideClient.js` + `connectGuide.js`) provides a fully audited pattern to copy for all four guides: dark theme, live host URL injection via `headers()`, `StepSection`/`CodeCard`/`CopyButton` client components, and the `export const dynamic = 'force-dynamic'` server pattern. The Python examples in `examples/openai-agents-governed/` and `examples/claude-code-review-agent/` show the exact narrative and code flow to adapt.

Python package versions are verified from PyPI as of 2026-03-23. Both LangGraph and CrewAI already have integration helpers in the Python SDK (`sdk-python/dashclaw/integrations/`) that should be referenced in the guides but should NOT be required by the minimal example scripts — D-07 mandates single-file, minimal examples using only direct SDK calls (`guard`, `create_action`, `update_outcome`).

**Primary recommendation:** Copy `app/connect/ConnectGuideClient.js` component structure verbatim for all four guides. Build each guide as a self-contained `page.js` with an inline guide content object (same pattern as `app/lib/connectGuide.js`). Keep Python examples to under 80 lines — one agent, one governed action, one clear output.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 (App Router) | already installed | JSX guide pages | Project runtime; `app/guides/*/page.js` pattern |
| `dashclaw` (npm) | 2.6.0 | Node SDK for OpenAI/Claude Code examples | Referenced in all existing Node examples |
| `dashclaw` (PyPI) | 2.6.0 | Python SDK for LangGraph/CrewAI examples | Verified on PyPI 2026-03-19 |
| `langgraph` | 1.1.3 | LangGraph example runtime | Latest stable on PyPI 2026-03-23 |
| `crewai` | 1.11.0 | CrewAI example runtime | Latest stable on PyPI 2026-03-23 |
| `langchain-core` | 1.2.21 | LangChain callback infrastructure | Required by langgraph |
| `@openai/agents` | 0.7.0+ | OpenAI Agents SDK (existing example pinned to ^0.7.0) | Already used in `examples/openai-agents-governed/` |

### Supporting (Python examples)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-dotenv` | latest | Load `.env` in examples | Both Python examples |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Self-contained page.js | Shared GuideLayout component | Shared layout adds abstraction; self-contained is simpler and matches /connect pattern |
| Direct SDK calls in examples | `DashClawCallbackHandler` / `DashClawCrewIntegration` | Integration helpers are more powerful but obscure the governance loop; D-07 mandates minimal direct calls |

**Version verification (PyPI, 2026-03-23):**
```
langgraph:       1.1.3  (requires Python >=3.10)
crewai:          1.11.0 (requires Python >=3.10 <3.14)
langchain-core:  1.2.21
dashclaw (PyPI): 2.6.0  (released 2026-03-19)
dashclaw (npm):  2.6.0
```

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
app/guides/
├── claude-code/
│   └── page.js          # Guide: Claude Code hooks
├── openai-agents-sdk/
│   └── page.js          # Guide: OpenAI Agents SDK
├── langgraph/
│   └── page.js          # Guide: LangGraph
└── crewai/
    └── page.js          # Guide: CrewAI

examples/
├── langgraph-governed/
│   ├── main.py          # Single-file example
│   ├── requirements.txt # Pinned versions
│   └── README.md        # Brief usage instructions
└── crewai-governed/
    ├── main.py          # Single-file example
    ├── requirements.txt # Pinned versions
    └── README.md        # Brief usage instructions
```

Modified files:
```
app/connect/page.js          # Add "Framework Guides" card section (D-10)
app/self-host/page.js        # Add 4-card guide links section (D-12)
README.md                    # Ensure /connect link is present (D-11)
```

### Pattern 1: Guide Page (Server Component + Inline Content)

The guide pages follow the exact `/connect` server component pattern. Each `page.js` is a server component that injects the live host URL and passes it to a client component.

```javascript
// app/guides/langgraph/page.js
// Source: app/connect/page.js (established pattern)
import { headers } from 'next/headers';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'LangGraph Integration Guide - DashClaw',
  description: 'Connect a LangGraph agent to DashClaw in under 20 minutes.',
};

export default async function LangGraphGuidePage() {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost:3000';
  const baseUrl = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    ? `http://${host}`
    : `https://${host}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNavbar />
      <main className="px-6 pb-20 pt-28">
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumb */}
          <div className="mb-8 flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-300">Home</Link>
            <ChevronRight size={14} />
            <Link href="/connect" className="transition-colors hover:text-zinc-300">Connect</Link>
            <ChevronRight size={14} />
            <span className="text-zinc-300">LangGraph</span>
          </div>
          {/* Guide content — pass baseUrl as prop */}
          <LangGraphGuideContent baseUrl={baseUrl} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
```

The content section can either be a separate `LangGraphGuideClient.js` client component or inline JSX using `CopyableCodeBlock` from `app/components/CopyableCodeBlock.js` (already a client component).

### Pattern 2: Guide Step Structure (D-02)

All four guides follow this 5-7 step structure. This mirrors `/connect`'s `StepSection` component pattern:

```
Step 1: Deploy DashClaw (link to /self-host or deploy button)
Step 2: Install the SDK (pip/npm install command)
Step 3: Set environment variables (DASHCLAW_BASE_URL + DASHCLAW_API_KEY)
Step 4: Write your first guard call (minimal code block)
Step 5: Run the example
Step 6: See the result in /decisions (D-05 proof moment)
Step 7 (optional): Review the guardrails.yml policy example (D-03)
```

### Pattern 3: Live Host URL Injection

The `/connect` page demonstrates the canonical pattern. Avoid hardcoding URLs.

```javascript
// Source: app/lib/connectGuide.js
function getBaseUrl(host) {
  if (!host) return 'https://your-dashclaw-instance.example.com';
  if (isMarketingHost(host)) return 'https://your-dashclaw-instance.example.com';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1')
    ? 'http' : 'https';
  return `${protocol}://${host}`;
}
```

Guide pages derive `baseUrl` from `headers()` and pass it into code snippets via template literals. This means env block snippets show the real URL of the current deployment.

### Pattern 4: Python Example Script Structure

Based on `examples/first-governed-action.py` and `examples/openai-agents-governed/index.js` adapted for Python:

```python
# examples/langgraph-governed/main.py
# Single file, ~60-80 lines, runs in < 30 seconds
import os
from dashclaw import DashClaw, GuardBlockedError

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="langgraph-agent",
)

# Guard check before the tool node fires
result = claw.guard({
    "action_type": "research",
    "declared_goal": "Summarize document via LangGraph node",
    "risk_score": 30,
})

if result.get("decision") == "block":
    print(f"Blocked: {result.get('reasons', [])}")
else:
    # Action record
    action = claw.create_action(
        "research",
        "Summarize document via LangGraph node",
        risk_score=30,
    )
    action_id = action["action_id"]

    # ... LangGraph node work here ...

    claw.update_outcome(action_id, status="completed",
                        output_summary="Summary complete")
    print(f"View decision: {os.environ['DASHCLAW_BASE_URL']}/decisions/{action_id}")
```

### Pattern 5: guardrails.yml Policy Example (D-03)

Each guide includes a self-contained guardrails.yml snippet relevant to that framework's typical use case. Based on verified existing pack format (`app/lib/guardrails/packs/development/guardrails.yml`):

```yaml
# Framework-specific guardrails.yml example (governance-as-code)
# Source: app/lib/guardrails/packs/development/guardrails.yml (format reference)
version: 1
project: my-langgraph-agent
description: >
  Governance policy for a LangGraph research agent.
  High-risk tool calls require approval; low-risk reads auto-allow.

policies:
  - id: block_external_writes
    description: Writing to external systems requires human approval
    applies_to:
      tools:
        - file.write
        - api.post
    rule:
      require: approval
```

### Anti-Patterns to Avoid

- **Raw HTTP in Python examples:** D-08 mandates using the `dashclaw` pip package, not `urllib` or `requests` calls to `/api/guard` directly.
- **Importing `DashClawCallbackHandler` in the minimal example:** The integration helpers in `sdk-python/dashclaw/integrations/` are powerful but add complexity. Guide examples use direct SDK calls only; the guide prose can mention the helper as "also available."
- **Hardcoded URLs in code snippets:** All `DASHCLAW_BASE_URL` references must be template-literal injected or shown as `${baseUrl}` with a real value when the guide page is served.
- **Using `headers()` outside a server component:** `headers()` is async in Next.js 15. Guide pages must be `async function` server components with `export const dynamic = 'force-dynamic'`.
- **Requiring ANTHROPIC_API_KEY or OPENAI_API_KEY for Python examples:** D-07 says real SDK calls — the DashClaw SDK calls are the proof point. Framework-specific calls (LLM invocations) should be simulated or optional.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Copy-paste code blocks | Custom clipboard component | `CopyableCodeBlock` from `app/components/CopyableCodeBlock.js` | Already built, tested, consistent style |
| Live URL injection | Re-implement host parsing | `getBaseUrl()` logic from `app/lib/connectGuide.js` | Handles marketing host filtering, localhost detection |
| Dark-theme step layout | New layout primitives | Copy `StepSection` / `CodeCard` / `CopyButton` from `ConnectGuideClient.js` | Identical visual pattern needed by D-01 |
| Python env loading | Custom .env parser | `python-dotenv` via `load_dotenv()` | Standard; used throughout Python ecosystem |
| Claude Code hook scripts | New hook implementations | `hooks/dashclaw_pretool.py` + `hooks/dashclaw_posttool.py` (existing files) | Already implemented, tested in production |

**Key insight:** This is a content/DX phase, not an infrastructure phase. Every primitive needed (copy buttons, host injection, dark theme, SDK, hook scripts) already exists. The work is assembling it into four guide pages and two example scripts.

---

## Runtime State Inventory

> Skipped — this is a greenfield content phase (new `app/guides/` pages + new Python example directories). No renaming, no data migration, no runtime state affected.

---

## Common Pitfalls

### Pitfall 1: Marketing Host Leaks into Live URL Snippets
**What goes wrong:** A guide page served from `dashclaw.io` injects `https://dashclaw.io` as the `DASHCLAW_BASE_URL` — the exact wrong URL.
**Why it happens:** The `isMarketingHost()` check in `connectGuide.js` handles this, but guide pages that re-implement host detection from scratch often skip it.
**How to avoid:** Copy the `getBaseUrl()` / `isMarketingHost()` logic verbatim from `app/lib/connectGuide.js` or import it directly.
**Warning signs:** URL snippet shows `https://dashclaw.io/api/guard` instead of a placeholder.

### Pitfall 2: Python Example Requires LLM API Key to Run
**What goes wrong:** The example fails with `OPENAI_API_KEY not set` before it reaches the DashClaw SDK call.
**Why it happens:** LangGraph and CrewAI tutorials typically initialize an LLM in the constructor.
**How to avoid:** Either skip the LLM initialization entirely (pure DashClaw calls with simulated content), or make it optional with a clear `if not OPENAI_API_KEY: use_simulation = True` branch. D-07 mandates the example runs in < 30 seconds with only DashClaw credentials.
**Warning signs:** `requirements.txt` lists `openai>=` or `anthropic` as required rather than optional.

### Pitfall 3: `headers()` Called Outside Async Server Component
**What goes wrong:** Runtime error: `headers()` was called outside a Server Component or while rendering.
**Why it happens:** Forgetting `export const dynamic = 'force-dynamic'` or making the component non-async.
**How to avoid:** All guide `page.js` files must be `export default async function` with `export const dynamic = 'force-dynamic'` at the top — copy from `app/connect/page.js` exactly.
**Warning signs:** Build passes but page throws at runtime.

### Pitfall 4: New Page.js Without `export const dynamic`
**What goes wrong:** Next.js 15 may statically render the guide page, caching the URL from build time rather than deriving it from the live request host.
**Why it happens:** `headers()` only works in dynamic routes; without `force-dynamic`, the build may attempt static optimization.
**How to avoid:** All four guide `page.js` files must include `export const dynamic = 'force-dynamic'`.

### Pitfall 5: CrewAI Example Requires Python 3.9
**What goes wrong:** `pip install crewai` fails or imports error on Python 3.9.
**Why it happens:** crewai 1.11.0 requires `Python >=3.10 <3.14`.
**How to avoid:** Pin Python requirement in README: "Requires Python 3.10+". Both langgraph and crewai share this constraint.
**Warning signs:** `pip install` succeeds but `import crewai` raises a syntax error.

### Pitfall 6: Stale `action_id` Extraction
**What goes wrong:** `action_id` is `undefined` because the response shape is `{ action: { action_id: "act_..." } }` not `{ action_id: "act_..." }`.
**Why it happens:** The SDK wraps the action object. The existing examples handle this with `res.action?.action_id || res.action_id`.
**How to avoid:** In Python examples, use `action["action_id"]` since `create_action` in the Python SDK returns the raw API response — confirm via `sdk-python/dashclaw/client.py` line 325-339 which returns `_request("/api/actions", ...)` directly. The raw response includes `action_id` at the top level.

---

## Code Examples

Verified patterns from existing codebase:

### Python SDK: Core Governance Loop
```python
# Source: examples/first-governed-action.py (verified)
from dashclaw import DashClaw

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="my-agent",
)

# 1. Guard check
result = claw.guard({
    "action_type": "deploy",
    "risk_score": 85,
    "declared_goal": "Deploy build v2.1.0 to production",
    "reasoning": "Build passed all CI checks",
})
decision = result.get("decision", "unknown")
action_id = result.get("action_id")

# 2. Create action record (if not blocked)
res = claw.create_action("deploy", "Deploy build v2.1.0 to production", risk_score=85)
action_id = res["action_id"]

# 3. Update outcome
claw.update_outcome(action_id, status="completed", output_summary="Deployed successfully")
```

### Python SDK: Assumption Recording
```python
# Source: sdk-python/README.md (verified)
assumption = claw.register_assumption(action_id, "API rate limit is 1000 req/min")
```

### Python SDK: Wait for Approval
```python
# Source: sdk-python/dashclaw/client.py line 345
claw.wait_for_approval(action_id, timeout=300, interval=5)
```

### Node SDK: Full Governance Loop (OpenAI Agents pattern)
```javascript
// Source: examples/openai-agents-governed/index.js (verified)
const decision = await claw.guard({
  action_type: 'delete_pii_records',
  declared_goal: 'Delete customer records containing SSN data',
  risk_score: 85,
  systems_touched: ['customer_database'],
  metadata: { record_count: 2 },
});

if (decision.decision === 'require_approval') {
  await claw.waitForApproval(actionId);
}

await claw.updateOutcome(actionId, {
  status: 'completed',
  output_summary: 'Deleted 2 PII records.',
});
```

### Claude Code Hook Settings Merge
```json
// Source: hooks/settings.json (verified)
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Edit|Write|MultiEdit",
      "hooks": [{"type": "command", "command": "python .claude/hooks/dashclaw_pretool.py"}]
    }],
    "PostToolUse": [{
      "matcher": "Bash|Edit|Write|MultiEdit",
      "hooks": [{"type": "command", "command": "python .claude/hooks/dashclaw_posttool.py"}]
    }]
  }
}
```

### ConnectGuideClient CopyButton Pattern (reusable)
```javascript
// Source: app/connect/ConnectGuideClient.js (verified)
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-full border ...">
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
```

### guardrails.yml Format (verified format)
```yaml
# Source: app/lib/guardrails/packs/development/guardrails.yml (verified)
version: 1
project: my-agent
description: >
  Governance policy description.
policies:
  - id: policy_id
    description: Human-readable description
    applies_to:
      tools:
        - tool.name
    rule:
      require: approval   # or: block: true
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LangGraph 0.x (StateGraph with separate checkpointer) | LangGraph 1.1.3 (same StateGraph API; checkpointer is optional) | Mid-2025 | API is stable; basic guard-in-node pattern unchanged |
| CrewAI 0.x (@crew decorator) | CrewAI 1.x (`@CrewBase`, `@agent`, `@task`, `@crew` decorators) | 2025 | New decorator-based API is idiomatic for 1.x |
| dashclaw npm v1 (full platform, 177+ methods) | dashclaw npm v2 (5 core methods: guard, createAction, updateOutcome, recordAssumption, waitForApproval) | Late 2025 | Guides use v2 surface only — simpler, cleaner for new integrators |

**Deprecated/outdated:**
- `dashclaw/legacy` import path: v1 extended API still works but guides should NOT reference it — creates confusion for new users
- CrewAI 0.x `Crew(agents=[...], tasks=[...]).kickoff()` syntax: still partially works but 1.x uses `@CrewBase` class pattern

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | Guide pages (Next.js dev) | Assumed present (project runs) | — | — |
| Python 3.10+ | LangGraph + CrewAI examples | Not verified on this machine | — | Note in README |
| pip | Python examples install | Not verified on this machine | — | Note in README |
| `dashclaw` (npm 2.6.0) | Node examples | Published on npm | 2.6.0 | — |
| `dashclaw` (PyPI 2.6.0) | Python examples | Published on PyPI | 2.6.0 | — |
| `langgraph` (1.1.3) | LangGraph example | Published on PyPI | 1.1.3 | — |
| `crewai` (1.11.0) | CrewAI example | Published on PyPI | 1.11.0 | — |

**Missing dependencies with no fallback:** None blocking this phase. Python runtime requirement is a developer prereq, not a deploy-time dependency.

**Note:** Python examples require Python 3.10+ due to langgraph and crewai requirements. READMEs for both new example directories must state this clearly.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via `npm run lint` + `npm run build`) — no dedicated unit tests in this codebase for content pages |
| Config file | `next.config.mjs` (build validation) |
| Quick run command | `npm run lint` |
| Full suite command | `npm run build && npm run governance:boundary:check && npm run openapi:check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| GUIDE-01 | Claude Code guide page renders at /guides/claude-code | smoke | `npm run build` — build fails if JSX syntax errors | Page must export default + dynamic |
| GUIDE-02 | OpenAI guide page renders at /guides/openai-agents-sdk | smoke | `npm run build` | Same |
| GUIDE-03 | LangGraph guide page renders at /guides/langgraph | smoke | `npm run build` | Same |
| GUIDE-04 | CrewAI guide page renders at /guides/crewai | smoke | `npm run build` | Same |
| GUIDE-05 | All pages follow conversion-guide structure | manual review | — | Visual confirmation; no automated test |
| GUIDE-06 | All 4 guides navigable from README, /connect, /self-host | smoke | `npm run lint` + manual spot check | Link correctness is compile-time, route correctness is manual |

**Also required:** `npm run governance:boundary:check` — new `app/guides/` pages are NOT under `app/api/` so they will not trigger the governance boundary check. Verify this by running the check after adding guide pages.

### Sampling Rate
- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run build && npm run governance:boundary:check`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test infrastructure needed. Existing `npm run build` catches JSX errors. The governance boundary check will pass since guide pages live under `app/guides/`, not `app/api/`.

---

## Open Questions

1. **Shared GuideLayout component vs. self-contained pages**
   - What we know: CONTEXT.md marks this as Claude's discretion
   - What's unclear: Whether 4 nearly-identical pages will create maintenance burden
   - Recommendation: Use a shared `GuideLayout` wrapper component (similar to how `StepSection` is shared in ConnectGuideClient) but keep guide content data inline per-page. This avoids over-engineering while reducing copy-paste of structural JSX.

2. **LangGraph example LLM requirement**
   - What we know: LangGraph requires at least one LLM node to be meaningful; langgraph 1.1.3 supports LCEL-style Runnable chains
   - What's unclear: D-07 says "real SDK calls, not mocks" — does this mean the LangGraph StateGraph node must actually call an LLM, or is simulated node output acceptable?
   - Recommendation: Simulate the LLM response in the node (use a hardcoded string), but use real `claw.guard()` + `claw.create_action()` calls so the governance proof is real. This satisfies D-07 (real SDK calls) without requiring an OPENAI_API_KEY.

3. **CrewAI @tool decorator vs. callback integration**
   - What we know: CONTEXT.md says "CrewAI integration guide with `@tool` decorator pattern". The existing `DashClawCrewIntegration` in `sdk-python/dashclaw/integrations/crewai.py` uses a task callback approach.
   - What's unclear: Should the guide show the `@tool` decorator wrapping a guard call, or the `DashClawCrewIntegration.task_callback` approach?
   - Recommendation: Use `@tool` decorator with inline guard call — it's more visible, more educational, and matches CONTEXT.md D-04 (locked decision). Mention `DashClawCrewIntegration` in a "going further" section only.

4. **README /connect link placement**
   - What we know: D-11 says README links to /connect (one link); D-11 says /connect cards handle framework selection
   - What's unclear: Where exactly in README — above the fold? Deploy section? Under "Connect your first agent"?
   - Recommendation: Add or verify a link in the existing "Connect your first agent" or "After deploy" section. If a link already exists to /connect, no change needed — D-11 is satisfied.

---

## Sources

### Primary (HIGH confidence)
- `app/connect/page.js` — Server component pattern: `force-dynamic`, `headers()`, host injection
- `app/connect/ConnectGuideClient.js` — UI components: `CopyButton`, `CodeCard`, `StepSection`, `InfoList`
- `app/lib/connectGuide.js` — `getBaseUrl()`, `isMarketingHost()` host injection logic
- `hooks/dashclaw_pretool.py` — Claude Code PreToolUse hook implementation
- `hooks/settings.json` — Claude Code hooks settings.json merge snippet
- `sdk-python/dashclaw/client.py` — Python SDK: `guard()`, `create_action()`, `update_outcome()`, `wait_for_approval()`
- `sdk-python/dashclaw/integrations/langchain.py` — `DashClawCallbackHandler` for LangChain
- `sdk-python/dashclaw/integrations/crewai.py` — `DashClawCrewIntegration` for CrewAI
- `examples/openai-agents-governed/index.js` — Full Node governance loop pattern
- `examples/first-governed-action.py` — Minimal Python governance pattern
- `app/lib/guardrails/packs/development/guardrails.yml` — Verified guardrails.yml format
- PyPI registry (2026-03-23): langgraph 1.1.3, crewai 1.11.0, langchain-core 1.2.21, dashclaw 2.6.0
- npm registry (2026-03-23): dashclaw 2.6.0

### Secondary (MEDIUM confidence)
- PyPI package metadata for crewai 1.11.0: Python >=3.10 <3.14 requirement confirmed
- PyPI package metadata for langgraph 1.1.3: Python >=3.10 requirement confirmed

### Tertiary (LOW confidence — needs validation during implementation)
- LangGraph 1.1.3 StateGraph API stability: assumed stable based on 1.x version; verify during implementation that `StateGraph`, `add_node`, and `invoke` signatures match
- CrewAI 1.x `@tool` decorator: assumed to follow `from crewai.tools import tool` import; verify exact import path during implementation

---

## Project Constraints (from CLAUDE.md)

Directives from `CLAUDE.md` that the planner must enforce:

| Directive | Impact on This Phase |
|-----------|---------------------|
| No new frameworks or state libraries | Guide pages use only Next.js JSX + existing components — no new libs |
| No direct SQL in route files | Not applicable — no new API routes in this phase |
| Governance boundary check (`npm run governance:boundary:check`) | Must pass after adding guide pages; `app/guides/` is not `app/api/` so boundary is safe |
| `export const dynamic = 'force-dynamic'` not explicitly required by CLAUDE.md | Required by Next.js 15 App Router pattern established in connect/page.js |
| `.env` not committed | Python example scripts use `os.environ` with `.env.example` provided |
| `process.on('unhandledRejection', ...)` in Node entry points | Required in any Node example scripts |
| Look First: inspect before creating | Research done — `app/guides/` does not exist yet, creation is appropriate |
| No refactors unless required | This phase adds content only; no refactoring of existing pages except minimal additions to /connect, /self-host, README |
| One feature per change | Each guide page and each example is a separate atomic change |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified from PyPI and npm registries 2026-03-23
- Architecture patterns: HIGH — derived from verified existing code in repo
- Python SDK methods: HIGH — verified in `sdk-python/dashclaw/client.py`
- CrewAI/LangGraph API specifics: MEDIUM — package versions verified, exact 1.x API call signatures not tested locally
- Pitfalls: HIGH — derived from code analysis of existing patterns

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable library versions — langgraph and crewai release frequently, re-verify if > 2 weeks pass before implementation)
