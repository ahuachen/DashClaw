# Market Intelligence Briefing Demo Design Spec

**Date:** 2026-04-09
**Status:** Draft
**Author:** Wes + Claude

## Overview

A single `node scripts/seed-demo.mjs` command that creates a full-stack demo exercising every major DashClaw feature: knowledge collections, capabilities (real HTTP APIs), workflow templates, guard policies, model strategies, artifacts, and HITL approvals. Then one workflow execution shows the entire governance story in 30 seconds.

### The Demo Story

"You run a tech company. Every morning, an agent runs a Market Intelligence Briefing: it searches your strategy docs, fetches the latest tech news, analyzes what matters to your business, notifies your team, and publishes the briefing — all governed by DashClaw."

### The "Aha" Moment

Execute the workflow. Open Mission Control and watch:
1. Knowledge search runs (internal, no governance needed)
2. HN news fetch auto-allows (green — risk 10)
3. LLM analysis runs via model strategy (artifact captured)
4. Team webhook fires with a warn (yellow — risk 55)
5. External publish pauses: "Requires Approval" (orange — risk 80)
6. Operator approves/denies in Mission Control
7. Full briefing with all artifacts visible on run detail page

## What Gets Seeded

### Knowledge Collection: "Company Strategy"

3 markdown documents seeded as knowledge items:

**1. product-roadmap.md** — Fictional company "Nexus AI" product roadmap
- Current focus: AI agent orchestration platform
- Q2 priorities: multi-agent workflows, enterprise SSO, cost optimization
- Competitive advantage: governance-first approach

**2. competitive-landscape.md** — Competitor analysis
- Competitor A: strong in model hosting, weak in governance
- Competitor B: good workflows, no approval flows
- Key differentiator: DashClaw-like governance (meta!)

**3. target-markets.md** — Market segments
- Enterprise fintech (high compliance needs)
- Healthcare AI (regulatory requirements)
- Government contractors (audit trail requirements)

These are seeded as items in a knowledge collection. If an OpenAI embedding key is configured in org settings, the seed script calls `/api/knowledge/collections/{id}/sync` to index them. If not, the knowledge_search step degrades gracefully.

### 5 Capabilities (Real HTTP APIs)

| # | Name | Endpoint | Method | Risk | Category |
|---|---|---|---|---|---|
| 1 | Hacker News Top Stories | `https://hacker-news.firebaseio.com/v0/topstories.json` | GET | low | external_api |
| 2 | HN Story Detail | `https://hacker-news.firebaseio.com/v0/item/{id}.json` | GET | low | external_api |
| 3 | IP Geolocation | `http://ip-api.com/json/{query}` | GET | medium | external_api |
| 4 | Team Notification | `https://httpbin.org/post` | POST | medium | webhook |
| 5 | Publish Briefing | `https://dpaste.org/api/` | POST | high | external_api |

All are free, no-auth-required public APIs. The seed script registers each with `source_type: 'http_api'`, the appropriate `risk_level`, and invocation schema including endpoint, method, and timeout.

### 3 Guard Policies

| Policy | Type | Rule | Effect |
|---|---|---|---|
| Auto-Allow Research | threshold | risk_score < 30 | allow |
| Warn on External Data | threshold | risk_score 30-60 | warn |
| Require Approval for Publishing | threshold | risk_score > 70 | require_approval |

### Model Strategy: "Briefing Analysis"

```json
{
  "name": "Briefing Analysis",
  "description": "Cost-balanced strategy for market intelligence analysis",
  "config": {
    "primary": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "costSensitivity": "balanced",
    "maxRetries": 1
  }
}
```

### Workflow Template: "Daily Market Briefing"

5 steps exercising all 3 step types:

| Step | Type | Description | Risk | Governance |
|---|---|---|---|---|
| 1 | `knowledge_search` | Search strategy docs for priorities | — | Internal |
| 2 | `capability_invoke` | Fetch HN top stories | 10 | Auto-allow |
| 3 | `prompt` | Analyze news relevance to strategy | — | Model strategy |
| 4 | `capability_invoke` | POST analysis to team webhook | 55 | Guard warns |
| 5 | `capability_invoke` | Publish full briefing to dpaste | 80 | Requires approval |

Step 5 has `continue_on_failure: true` so the workflow completes even if the operator denies the publish.

Step 3 uses variable substitution: `${steps.search_strategy.output}` and `${steps.fetch_news.output}`.

## The Seed Script

`scripts/seed-demo.mjs` — Node.js script that:

1. Checks DashClaw is running (`GET /api/health`)
2. Creates the knowledge collection + 3 items
3. Optionally syncs embeddings (if embedding provider configured)
4. Creates 5 capabilities
5. Creates 3 policies
6. Creates model strategy
7. Creates workflow template linking everything
8. Prints a summary with links to Mission Control

**Config:** Uses `DASHCLAW_URL` (default `http://localhost:3000`) and `DASHCLAW_API_KEY` env vars. Same pattern as the existing `scripts/run-demo.mjs`.

**Idempotent:** Checks if demo data already exists (by name) before creating. Safe to re-run.

## Demo Documentation

A `DEMO.md` at the repo root (or update existing `QUICK-START.md`) with:
1. "Run the seed" — `node scripts/seed-demo.mjs`
2. "Execute the workflow" — Click "Run" on the Daily Market Briefing template, or `POST /api/workflows/templates/{id}/execute`
3. "Watch Mission Control" — Screenshots/descriptions of what you see
4. "Approve or deny the publish" — The HITL moment

## What This Exercises

Every major DashClaw feature in one demo:
- Knowledge Collections (semantic search)
- Capability Registry (5 real HTTP APIs)
- Capability Invoke (governed external calls)
- Workflow Engine (all 3 step types)
- Workflow Variables (`${steps.x.output}`)
- Guard Evaluation (3 risk tiers)
- Guard Policies (threshold rules)
- HITL Approvals (publish step)
- Model Strategies (LLM analysis step)
- Artifacts (auto-captured per step)
- `continue_on_failure` (workflow resilience)
- Mission Control (real-time operations feed)
- Decisions Ledger (full audit trail)

## Documentation Updates

- `CHANGELOG.md` — Add demo entry
- `README.md` — Add "Try the Demo" section
- `QUICK-START.md` — Reference the demo as next step after setup
- `examples/README.md` — Add demo entry

## Out of Scope

- Custom UI for the demo (Mission Control already shows everything)
- Demo teardown script (capabilities/policies can be deleted manually)
- Scheduled/recurring execution (no cron on free tier)
