# DashClaw Platform Feature Pack — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Scope:** 4 features — Approval Webhooks, Policy Template Gallery, Cost Dashboard, Message Trail in Decision Replay

---

## Overview

Four features that close gaps in the DashClaw platform. Ordered by implementation priority:

1. **Approval Webhooks** — Wire approval events into the existing webhook system
2. **Policy Template Gallery** — Surface existing policy packs with browsable UI and dry-run preview
3. **Cost Dashboard** — Surface existing cost/token data in Mission Control, actions list, and Replay
4. **Message Trail in Decision Replay** — Link agent messages to actions and display in Replay

Cross-cutting: all schema changes included in both base schema (fresh installs) and incremental migration (existing deployments).

---

## Feature 1: Approval Webhooks

### Problem

Webhooks only fire for signal events (anomaly detection). Approval events — the most time-sensitive notifications in the system — have no webhook support. Teams using PagerDuty, Opsgenie, or custom Slack bots can't receive approval requests.

### Changes

#### New Webhook Event Types

Rename `VALID_SIGNAL_TYPES` to `VALID_EVENT_TYPES` in `/app/api/webhooks/route.js` and add three approval events using snake_case to match existing convention:

- `approval_pending`
- `approval_granted`
- `approval_denied`

Existing signal types (`autonomy_spike`, `high_impact_low_oversight`, etc.) remain unchanged.

#### Webhook Payload Format

```json
{
  "event": "approval_pending",
  "org_id": "org_default",
  "timestamp": "2026-03-19T...",
  "action": {
    "action_id": "ar_...",
    "agent_id": "treasury-claw-fleet",
    "action_type": "api",
    "declared_goal": "buy_eth: $22.14 at ETH=$2139.89",
    "risk_score": 55,
    "status": "pending_approval",
    "matched_policies": ["gp_..."],
    "reason": "Policy 'Require approval for API calls' matched"
  },
  "approval_url": "https://your-instance.com/api/approvals/ar_...",
  "replay_url": "https://your-instance.com/replay/ar_..."
}
```

The `approval_url` field points to the existing `POST /api/approvals/{actionId}` endpoint, which accepts `{ decision: 'allow' | 'deny', reasoning?: string }`. External systems (PagerDuty, custom bots) POST directly to approve or deny.

#### New Function

`fireWebhooksForApproval(orgId, eventType, action, sql)` in `/app/lib/webhooks.js` (parameter order matches existing `fireWebhooksForOrg` convention — orgId first):

- Queries webhooks subscribed to the event type (or `all`)
- Calls existing `deliverWebhook()` for each
- Reuses HMAC signing, SSRF protection, failure tracking, auto-disable after 10 failures

#### Trigger Points

1. `/app/api/actions/route.js` — after action created with `pending_approval` status
2. `/app/api/approvals/[actionId]/route.js` — after approval or denial

#### New Table: `webhook_deliveries`

```sql
CREATE TABLE webhook_deliveries (
  id text PRIMARY KEY,
  webhook_id text NOT NULL REFERENCES webhooks(id),
  org_id text NOT NULL,
  event_type text NOT NULL,
  payload text,
  status text NOT NULL DEFAULT 'pending',
  response_status integer,
  response_body text,
  attempted_at timestamp DEFAULT now(),
  duration_ms integer
);
```

Code already references this table but the migration was missing. This fills the gap.

#### Files Modified

- `/app/api/webhooks/route.js` — add event types
- `/app/lib/webhooks.js` — add `fireWebhooksForApproval()`
- `/app/api/actions/route.js` — add webhook trigger on pending_approval
- `/app/api/approvals/[actionId]/route.js` — add webhook trigger on approve/deny
- `/schema/schema.js` — add `webhookDeliveries` table definition (Drizzle ORM export)
- `/drizzle/0000_clammy_falcon.sql` — add `webhook_deliveries` CREATE TABLE

**Note:** The existing `last_trigger_at` column name in `schema.js` differs from `last_triggered_at` in the raw SQL. New webhook code should use the Drizzle schema, not raw SQL, to avoid this inconsistency.

#### No SDK Changes

Purely server-side.

---

## Feature 2: Policy Template Gallery

### Problem

Four policy packs exist with a working import endpoint, but they're buried. New users don't discover them and must build policies from scratch. No way to preview what a pack contains before installing.

### Changes

#### New Endpoint: `GET /api/policies/templates`

Returns all available packs with full previews:

```json
{
  "templates": [
    {
      "id": "enterprise-strict",
      "name": "Enterprise Strict",
      "description": "Maximum security — all external actions blocked or gated",
      "policy_count": 5,
      "policies": [
        {
          "name": "Approve all external communications",
          "policy_type": "require_approval",
          "rules_summary": "action_types: [post, message, api]"
        }
      ],
      "recommended_for": "Regulated industries, SOC 2, financial services"
    }
  ]
}
```

Reads `policies.yml` from each pack directory in `app/lib/guardrails/packs/` (the same file the import endpoint uses). The `recommended_for` and display metadata come from the existing `PACK_PREVIEWS` object in `/app/policies/page.js` (line 40), which is moved to a shared module so both the UI and API can reference it.

#### Dry-Run Mode on Import Endpoint

`POST /api/policies/import?preview=true` returns what would be created without creating. Each policy runs through the existing `inferPolicyType()` logic so the preview matches what actually gets created:

```json
{
  "preview": true,
  "would_create": 5,
  "would_skip": 1,
  "policies": [
    { "name": "...", "policy_type": "...", "rules": "...", "conflict": false },
    { "name": "...", "policy_type": "...", "rules": "...", "conflict": true, "conflict_reason": "Policy with this name already exists" }
  ]
}
```

#### UI: Template Gallery on Policies Page

Add "Templates" tab or prominent "Browse Templates" button on `/app/policies/page.js`:

- Card layout: name, description, policy count, "recommended for" tag
- Click card to expand and see individual policies
- "Install" button with confirmation modal showing dry-run preview
- After install, redirect to policies list with new policies highlighted
- "Already installed" badge if all policies from a pack exist

#### Files Modified

- New: `/app/api/policies/templates/route.js`
- `/app/api/policies/import/route.js` — add `?preview=true` support
- `/app/policies/page.js` — add template gallery UI

#### No Schema Changes. No SDK Changes.

---

## Feature 3: Cost Dashboard

### Problem

The backend tracks `cost_estimate`, `tokens_in`, `tokens_out` per action with automatic cost calculation from model pricing. Aggregation queries already compute `SUM(cost_estimate)`. None of this is visible in the UI.

### Changes

#### New Endpoint: `GET /api/actions/costs`

```json
{
  "total_cost_usd": 142.87,
  "total_tokens_in": 2450000,
  "total_tokens_out": 890000,
  "period": "30d",
  "by_agent": [
    { "agent_id": "treasury-claw-fleet", "cost_usd": 89.42, "action_count": 312 },
    { "agent_id": "deploy-bot", "cost_usd": 53.45, "action_count": 187 }
  ],
  "by_day": [
    { "date": "2026-03-19", "cost_usd": 12.30, "action_count": 45 },
    { "date": "2026-03-18", "cost_usd": 8.91, "action_count": 38 }
  ]
}
```

Query params: `?period=7d|30d|90d`, `?agent_id=...`

Builds on existing `SUM(cost_estimate)` query in `actions.repository.js` — adds GROUP BY agent and GROUP BY date dimensions.

#### Mission Control Widget: "Agent Spend"

Compact card on Mission Control dashboard:

- Total spend (current period) with trend arrow vs previous period
- Sparkline of daily spend (last 30 days)
- Top 3 agents by spend

Follows existing widget pattern (each widget fetches its own endpoint, renders a card).

#### Actions List View: Cost Column

Add `cost_estimate` and token counts to the decisions list at `/app/decisions/page.js` (the main actions list view — note: `/app/actions/page.js` does not exist; the list is at `/decisions`):

- Format: `$0.0042` for small costs, `$12.34` for larger
- Tokens: `1.2k in / 450 out`

#### Decision Replay: Cost Line

Add to "Final Result" section of `/app/replay/[actionId]/page.js`:

```
Result: completed in 2.3s | $0.0089 | 1,200 tokens in / 450 out
```

Only renders if `cost_estimate > 0`.

#### Files Modified

- New: `/app/api/actions/costs/route.js`
- `/app/lib/repositories/actions.repository.js` — add cost aggregation queries
- `/app/mission-control/` — add Agent Spend widget
- `/app/decisions/page.js` — add cost columns to the actions list view
- `/app/replay/[actionId]/page.js` — add cost line

**Performance note:** The GROUP BY queries on `action_records` may be slow for orgs with large action histories. Consider adding a composite index `(org_id, created_at)` if query times exceed 200ms. The existing `daily_totals` table could also be extended for cost aggregation as a future optimization.

#### No Schema Changes. No SDK Changes.

---

## Feature 4: Message Trail in Decision Replay

### Problem

You can see what an agent decided and whether it was allowed, but not what context another agent gave it. In multi-agent systems, the conversation that led to a decision is invisible.

### Changes

#### Schema Change: `action_id` on `agent_messages`

```sql
ALTER TABLE agent_messages ADD COLUMN action_id text;
CREATE INDEX idx_agent_messages_action_id ON agent_messages(action_id);
```

Optional foreign key. When set, explicitly links a message to an action.

#### New Endpoint: `GET /api/actions/[actionId]/messages`

Hybrid matching strategy (explicit + time-window):

1. **Explicit matches first**: Messages where `action_id` matches directly
2. **Time-window fallback**: If no explicit matches, fetch messages from the same agent within 60 seconds before action creation and 60 seconds after completion. **Important:** Both `agent_messages.created_at` and `action_records.timestamp_start` are stored as `text`, not `timestamp`. Queries must use `::timestamptz` casts for correct comparison (this is an existing pattern in `actions.repository.js`).
3. Deduplicate and sort chronologically

```json
{
  "messages": [
    {
      "id": "msg_...",
      "from_agent_id": "planner-agent",
      "to_agent_id": "treasury-claw-fleet",
      "message_type": "action",
      "subject": "Execute ETH purchase",
      "body": "Buy $22.14 of ETH at current market. Chain: Sepolia.",
      "created_at": "2026-03-19T10:02:45Z",
      "match_type": "explicit"
    }
  ],
  "correlation": "explicit",
  "total": 1
}
```

The `match_type` field distinguishes tagged messages from inferred ones. The `correlation` field indicates which strategy produced results.

#### Unarchive Messages API

Move `/api/_archive/messages/` routes back to `/api/messages/`. The existing routes are functional — they just need to be active for the message trail to work.

**Note:** This also fixes an existing bug — the SDK's `sendMessage()` already POSTs to `/api/messages`, which currently 404s because the routes are archived. Unarchiving restores SDK messaging functionality.

#### SDK Change: `actionId` on `sendMessage()`

The existing SDK uses camelCase parameters (`to`, `type`, `threadId`). Add `actionId` following the same convention:

```javascript
await client.sendMessage({
  to: 'treasury-claw-fleet',
  type: 'action',
  subject: 'Execute ETH purchase',
  body: 'Buy $22.14 of ETH at current market.',
  actionId: 'ar_...'  // optional — links message to action
});
```

The SDK translates `actionId` to `action_id` when POSTing to the API (same pattern as `to` -> `to_agent_id`, `type` -> `message_type`).

Optional field. When omitted, time-window correlation handles it.

#### Decision Replay UI: "Communication Trail" Section

Added between "Governance Decision" and "Final Result" in `/app/replay/[actionId]/page.js`:

- Collapsible section, expanded by default if messages exist, hidden if none
- Chat-bubble layout: left-aligned for incoming, right-aligned for acting agent
- Each bubble: `from_agent_id`, timestamp, body (rendered via existing `MarkdownBody` component)
- Subtle label on time-window matches: "inferred from timing"
- Thread context: if messages belong to a thread, show thread name as header
- DLP: messages are already redacted via `scanSensitiveData()` at write time (in the POST handler). The replay UI displays the stored (already-redacted) content — no double-redaction needed.

#### Files Modified

- `/schema/schema.js` — add `actionId` column to `agentMessages`
- `/drizzle/0000_clammy_falcon.sql` — add `action_id` to `CREATE TABLE agent_messages`
- New: `/app/api/actions/[actionId]/messages/route.js`
- Move: `/app/api/_archive/messages/` to `/app/api/messages/`
- `/app/replay/[actionId]/page.js` — add Communication Trail section
- `/sdk/dashclaw.js` — add `action_id` param to `sendMessage()`

---

## Cross-Cutting: Fresh Install Compatibility

All schema changes must exist in both the base schema (fresh installs) and an incremental migration (existing deployments).

### Files Updated

1. **`schema/schema.js`** — Drizzle ORM definitions:
   - Add `actionId` column to `agentMessages` table
   - Add `webhookDeliveries` table definition

2. **`drizzle/0000_clammy_falcon.sql`** — Base migration:
   - Add `action_id text` column to `CREATE TABLE agent_messages`
   - Add `CREATE TABLE webhook_deliveries`
   - Add `CREATE INDEX idx_agent_messages_action_id`

3. **`scripts/auto-migrate.mjs`** — Currently hardcodes the path to `0000_clammy_falcon.sql` (line 65). Two options:
   - **(Recommended) Option A:** Fold all new DDL into `0000_clammy_falcon.sql` using `IF NOT EXISTS` guards. This is idempotent and matches how the script already works — no script changes needed.
   - **Option B:** Update `auto-migrate.mjs` to glob all `drizzle/*.sql` files sorted by filename. More correct long-term but a larger change.

   We go with **Option A**: add `CREATE TABLE IF NOT EXISTS webhook_deliveries`, `ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS action_id text`, and `CREATE INDEX IF NOT EXISTS idx_agent_messages_action_id` to the end of `0000_clammy_falcon.sql`. Existing deployments re-run the script safely (IF NOT EXISTS guards prevent errors). Fresh installs get everything in one pass.

---

## Implementation Order

| # | Feature | Effort | Dependencies |
|---|---------|--------|-------------|
| 1 | Approval Webhooks | Small | Migration (webhook_deliveries) |
| 2 | Policy Template Gallery | Small | None |
| 3 | Cost Dashboard | Small-Medium | None |
| 4 | Message Trail in Replay | Medium | Migration (action_id on agent_messages), unarchive messages API |

Features 1-2 can be built in parallel. Feature 3 is independent. Feature 4 depends on its migration.

The incremental migration file covers both Feature 1 and Feature 4 schema changes in a single migration.

---

## Out of Scope

- Cost budget alert policy type (`cost_threshold`) — future enhancement
- Community/external template registry — future enhancement
- Webhook retry queue with exponential backoff — existing failure tracking is sufficient for now
- Real-time message streaming in Replay — static fetch is sufficient for v1
