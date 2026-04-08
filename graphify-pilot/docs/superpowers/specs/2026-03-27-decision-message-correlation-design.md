# Decision-Message Correlation Design

**Date:** 2026-03-27
**Status:** Approved
**Approach:** A — "Stitch & Surface"

## Problem

DashClaw captures both agent messages (`agent_messages`) and governance decisions (`action_records`), but they are siloed. The `action_id` field exists on messages but is rarely populated. The UI shows messages and decisions on separate pages with no cross-linking. The only correlation mechanism is a fragile ±60-second time-window fallback.

Users cannot answer: "What did agents communicate before, during, and after this decision?"

## Design Principles

- Build on existing infrastructure — no new tables, no new core API routes
- Respect DashClaw's identity as governance infrastructure, not an observability platform
- Progressive disclosure — summary in the list, detail on click-through
- SDK handles tagging transparently — agent developers shouldn't think about correlation

## Components

### 1. SDK Action Context (Auto-Tagging)

The v2 SDK gets an `actionContext` method that returns a scoped client. Any message sent through the scoped client is automatically tagged with the `action_id`.

**Node.js SDK (`sdk/dashclaw.js`):**

```js
const action = await claw.createAction({ ... });

// Option 1: Explicit context parameter
await claw.sendMessage({ to: 'agent-b', body: '...' }, { actionId: action.action_id });

// Option 2: Scoped context (ergonomic)
const ctx = claw.actionContext(action.action_id);
await ctx.sendMessage({ to: 'agent-b', body: '...' });  // auto-tagged
await ctx.recordAssumption({ ... });                      // already linked
await ctx.updateOutcome({ ... });                         // closes context
```

**Python SDK (`sdk-python/dashclaw/`):**

```python
action = claw.create_action(...)

# Option 1: Explicit keyword argument
claw.send_message({"to": "agent-b", "body": "..."}, action_id=action["action_id"])

# Option 2: Context manager (Pythonic)
with claw.action_context(action["action_id"]) as ctx:
    ctx.send_message({"to": "agent-b", "body": "..."})  # auto-tagged
    ctx.record_assumption({...})                          # already linked
    ctx.update_outcome({...})                             # closes context
```

The context manager auto-cleans up if an exception occurs. Messages sent through the base `claw` client (outside context) remain untagged and fall back to time-window correlation.

### 2. Database & API Layer

**Database:**

One new composite index for fast message-by-action lookups:

```sql
CREATE INDEX idx_agent_messages_org_action ON agent_messages(org_id, action_id);
```

No new tables. No column changes. The `action_id` field already exists on `agent_messages`.

**API changes:**

1. **`GET /api/actions/[actionId]/messages?summary=true`** — new `summary` query parameter on the existing endpoint. Returns count and participants instead of full messages:
   ```json
   {
     "total": 3,
     "participants": ["agent-a", "agent-b"],
     "correlation": "explicit",
     "first_message_at": "2026-03-27T14:32:01Z",
     "last_message_at": "2026-03-27T14:32:05Z"
   }
   ```

2. **`GET /api/actions/[actionId]`** — extend the existing detail response to include `message_summary` (count + participants), so the decisions ledger can show a badge without a second fetch.

3. **SSE stream** — no changes. Existing `MESSAGE_CREATED` and `ACTION_CREATED` events include `action_id` when present. UI correlates client-side.

No new routes.

### 3. Decisions Ledger — Inline Message Trail

The existing decisions page (`app/decisions/page.js`) expands rows to show open loops and assumptions. A new "Messages" section appears in the same expandable area.

**Behavior:**
- Row expansion triggers existing detail fetch, which now includes `message_summary`
- If `message_summary.total > 0`, render a collapsible "Messages (N)" section below assumptions
- Clicking "Messages" lazy-loads full messages from `GET /api/actions/${actionId}/messages`
- Each message renders as a compact card: sender → recipient, body preview (2 lines), timestamp, match_type badge
- "View full →" link navigates to `/decisions/[actionId]`

**Layout within expanded row:**

```
┌─ Action Detail ──────────────────────────────────┐
│ Declared Goal: "Deploy config to staging"        │
│ Risk: 45 (yellow)  Confidence: 82  Duration: 3s  │
│                                                   │
│ ▸ Assumptions (2)                                 │
│ ▸ Open Loops (1)                                  │
│ ▸ Messages (3) — agent-a, agent-b                │
│                                                   │
│ Output: "Config deployed successfully"            │
│                                     View full →   │
└───────────────────────────────────────────────────┘
```

**Match type indicators:**
- `explicit` — solid link icon (agent SDK tagged this message)
- `time_window` — dashed link icon with tooltip: "Inferred from timestamp proximity"

### 4. Decision Timeline Page (`/decisions/[actionId]`)

A dedicated page showing the full causal chain for a single decision as a chronological thread.

**URL:** `/decisions/[actionId]`

**Data sources** (fetched in parallel):
- `GET /api/actions/[actionId]` — action detail, assumptions, open loops
- `GET /api/actions/[actionId]/messages` — correlated messages

**Layout — single chronological timeline:**

All events merged and sorted by timestamp. Each event type gets a distinct icon and left-border color:

```
/decisions/act_7f3k2...

← Back to Decisions

Agent: agent-a · Risk: 45 (yellow) · Status: completed
Goal: "Deploy config to staging"

─── Timeline ──────────────────────────────────────

🛡  14:31:58  GUARD
   Policy: deploy-staging-review
   Decision: ALLOW (risk 45, threshold 70)
   Mode: enforce

💬  14:32:01  MESSAGE  agent-a → agent-b  [explicit]
   "Deploying config v2.3 to staging, need env confirmation"

💬  14:32:03  MESSAGE  agent-b → agent-a  [explicit]
   "Staging env ready, proceed"

▶  14:32:04  ACTION STARTED
   Type: deploy · Systems: ["staging-k8s"]
   Reasoning: "Config v2.3 validated, staging confirmed ready"

📌  14:32:04  ASSUMPTION
   "Staging env has no active deploys"
   Status: validated

💬  14:32:05  MESSAGE  agent-a → agent-b  [explicit]
   "Deploy complete, running validation..."

✅  14:32:07  OUTCOME
   "Config deployed successfully"
   Duration: 3s · Cost: $0.002 · Tokens: 450 in / 120 out

⚠  14:32:07  OPEN LOOP
   "Validation results pending from monitoring agent"
   Priority: medium · Status: open
```

**Details:**
- Guard decision reconstructed from the action's `risk_score`, `reasoning`, and `authorization_scope` fields already present on `action_records`. No additional API call needed — this is display-only synthesis from existing data.
- Messages show full body with markdown rendering (not truncated)
- Match type badge on each message (explicit = solid, time_window = dashed)
- Assumptions and open loops placed at creation timestamps
- Header: quick stats + back link to ledger

### 5. Swarm Graph Enhancement

The existing swarm page (`app/swarm/page.js`) gets inspectable edges.

**Edge click → sidebar panel:**
- Message count between the two agents
- Last 5 messages (compact: sender, body preview, timestamp)
- Shared action count
- Last 3 shared actions (compact: goal, risk badge, status)
- "View all →" links to `/messages?agents=agent-a,agent-b` and `/decisions?agents=agent-a,agent-b`

**No new API routes.** The swarm page already fetches messages and actions per agent. Edge context is filtered client-side by the two selected agents.

**Not in scope:**
- Real-time packet inspection (animated packets stay decorative)
- New graph visualization library
- Message content rendered on the graph itself (stays in sidebar)

## Summary of Changes

| Component | Change |
|-----------|--------|
| **Node.js SDK** | New `actionContext(actionId)` method, auto-tags messages |
| **Python SDK** | New `action_context(actionId)` context manager |
| **Database** | One composite index: `agent_messages(org_id, action_id)` |
| **API** | Summary mode on existing messages endpoint, `message_summary` in action detail |
| **Decisions ledger** | Inline "Messages" expandable section in row detail |
| **Decision timeline** | New `/decisions/[actionId]` page with chronological thread |
| **Swarm graph** | Edge click shows message/action content in sidebar |

## What This Does NOT Include

- No new database tables
- No new core API routes (stays within governance boundary)
- No tool call or reasoning step capture (observability territory)
- No correlation engine or inference service
- No breaking changes to existing SDK methods
- No changes to SSE event types
