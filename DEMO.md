# DashClaw Demo: Market Intelligence Briefing

A full-stack demo that exercises every major DashClaw feature in one workflow execution.

## What It Creates

| Feature | What's Seeded |
|---|---|
| Knowledge Collection | 3 strategy documents (roadmap, competitors, markets) |
| Capabilities | 5 real HTTP APIs at different risk levels |
| Policies | 3 guard policies (auto-allow, warn, require approval) |
| Model Strategy | Balanced analysis strategy (Claude Sonnet) |
| Workflow Template | 5-step "Daily Market Briefing" |

## Prerequisites

1. DashClaw running locally: `npm run dev`
2. API key configured (check `/setup` page)

## Run the Demo

### Step 1: Seed demo data

```bash
node scripts/seed-demo-capabilities.mjs
```

This creates the knowledge collection, 5 capabilities, 3 policies, a model strategy, and the workflow template. Safe to re-run (idempotent).

### Step 2: Execute the workflow

Open your DashClaw instance and navigate to **Workflows**. Find "Daily Market Briefing" and click **Run**.

Or execute via API:

```bash
curl -X POST http://localhost:3000/api/workflows/templates/<TEMPLATE_ID>/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"agent_id": "demo-agent"}'
```

### Step 3: Watch Mission Control

Open `/mission-control` and watch the operations feed in real-time:

1. **Knowledge Search** — Searches your strategy docs (internal, no governance)
2. **HN News Fetch** — Auto-allowed (risk 10, green)
3. **LLM Analysis** — Runs via model strategy, produces the briefing
4. **Team Notification** — Guard warns (risk 55, yellow) but proceeds
5. **Publish Briefing** — Requires approval (risk 80, orange) — pauses here

### Step 4: Approve or deny

Navigate to **Approvals** (or click the pending item in Mission Control). You'll see the publish action waiting for your decision:

- **Approve** — The briefing is published to dpaste.org and the workflow completes
- **Deny** — The publish step fails but the workflow still completes (`continue_on_failure: true`)

### Step 5: Review the trail

Open **Decisions** to see the full audit trail: every guard evaluation, every action record, every artifact captured from each workflow step.

## What This Exercises

| DashClaw Feature | How |
|---|---|
| Knowledge Collections | Semantic search in Step 1 |
| Capability Registry | 5 HTTP APIs at different risk levels |
| Capability Invoke | Steps 2, 4, 5 call real external APIs |
| Workflow Engine | All 3 step types (knowledge_search, capability_invoke, prompt) |
| Workflow Variables | `${steps.search_strategy.output}` in Step 3 |
| Guard Evaluation | Risk 10 → allow, 55 → warn, 80 → require_approval |
| HITL Approvals | Step 5 pauses for human decision |
| Model Strategies | Step 3 uses configured analysis strategy |
| Artifacts | Each step output auto-captured |
| Policies | 3 threshold policies at different levels |
| continue_on_failure | Workflow completes even if publish denied |
| Mission Control | Real-time operations feed |
| Decisions Ledger | Full audit trail |

## Troubleshooting

**"Cannot reach DashClaw"** — Make sure `npm run dev` is running and the URL is correct.

**Knowledge search returns empty** — Embeddings require an OpenAI key configured in org settings. The workflow still runs; the analysis step just won't have strategy context.

**"Model strategy execution failed"** — The prompt step requires a BYOK provider key (Anthropic or OpenAI) in org settings. Configure at `/settings`.
