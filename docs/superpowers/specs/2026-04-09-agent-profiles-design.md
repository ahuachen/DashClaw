# Agent Profiles Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Replace the current `/agents/[agentId]` detail page with a governance-focused agent profile.

## Goal

Give operators a single page that answers "should I trust this agent?" by stitching together the governance narrative — decisions, assumptions, signals, trust posture — that is currently scattered across separate pages.

## Audience

Primary: Operator/admin managing a fleet of agents.
Secondary: Compliance/security stakeholders who need audit-ready views.

## Design Decisions

- **Approach:** Enhance the existing `/agents/[agentId]` page (not a new route).
- **Hero content:** Decision history, not operational metrics.
- **Layout:** Stacked sections in a single scrollable column, no tabs.
- **Decision table:** Filtered table matching the Decisions Ledger interaction model, scoped to one agent.
- **Scope:** Governance narrative + vitals strip. Sessions, token budgets, connections, and schedules stay on their existing pages.

## Architecture

### New API Endpoint

**`GET /api/agents/[agentId]/profile`**

Aggregates governance data in a single call to minimize client round-trips.

Response shape:

```json
{
  "agent": {
    "agent_id": "agt_abc",
    "agent_name": "Deploy Bot",
    "first_seen": "2026-03-02T00:00:00Z",
    "total_actions": 847,
    "total_cost": 12.34,
    "presence": {
      "status": "online",
      "last_heartbeat_at": "2026-04-09T16:00:00Z",
      "current_task_id": "task_xyz"
    }
  },
  "trust": {
    "permission_level": "workspace_write",
    "identity_verified": true,
    "signature_enforced": true,
    "active_policies_count": 3,
    "policies": [
      { "policy_id": "pol_1", "type": "require_approval", "description": "Risk > 70 requires human review", "scope": "global" },
      { "policy_id": "pol_2", "type": "rate_limit", "description": "Max 20 actions/hour", "scope": "agent" },
      { "policy_id": "pol_3", "type": "block_action_type", "description": "Cannot execute deploy", "scope": "agent" }
    ],
    "approval_record": { "total": 14, "allowed": 12, "denied": 2 },
    "blocks_30d": 2
  },
  "signals": [
    { "type": "autonomy_spike", "severity": "red", "label": "...", "detail": "..." }
  ],
  "assumptions_summary": {
    "total": 23,
    "validated": 14,
    "invalidated": 3,
    "unverified": 6
  }
}
```

This endpoint lives in `app/api/agents/[agentId]/profile/route.js` and calls:
- `getAgentDetail()` from agents.repository.js (presence + connections)
- New `getAgentTrustPosture()` from agents.repository.js (pairing, identity, policy counts, approval record, blocks)
- `computeSignals()` from signals.js filtered to this agent_id
- New `getAssumptionsSummary()` from assumptions.repository.js (count by validation state)

### New Repository Functions

**`getAgentTrustPosture(sql, orgId, agentId)`** in `agents.repository.js`

Queries:
- `agent_pairings` for permission_level and status
- `agent_identities` for identity_verified
- `org_settings` for signature enforcement
- `policies` table (`agent_ids` JSON column contains assigned agent IDs; null means global)
- `action_records` where status was `pending_approval` for approval record (count allowed vs denied via `approved_by` field)
- `action_records` where guard blocked in last 30d (joined with guard_decisions or status = 'blocked')

Returns the `trust` object from the response shape above.

**`getAssumptionsSummary(sql, orgId, agentId)`** in `assumptions.repository.js`

Single query:
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE validated = 1) AS validated,
  COUNT(*) FILTER (WHERE invalidated = 1) AS invalidated,
  COUNT(*) FILTER (WHERE validated = 0 AND invalidated = 0) AS unverified
FROM assumptions a
JOIN action_records ar ON a.action_id = ar.action_id AND ar.org_id = a.org_id
WHERE a.org_id = $1 AND ar.agent_id = $2
```

### Page Structure

**File:** `app/agents/[agentId]/page.js` (replaces current content)

The page is a client component that fetches from `/api/agents/[agentId]/profile` on mount, plus paginated calls to `/api/actions?agent_id=X` and `/api/assumptions?agent_id=X` for the detail sections.

#### Section 1: Vitals Strip

Single horizontal card at the top of the page.

Left side:
- Status dot (green/gray/amber) based on presence state
- Agent name (large text)
- `agent_id` in monospace below
- Verified badge if identity_verified is true

Right side:
- Compact stats: total actions, cumulative cost, first-seen date
- Online/offline/stale label with "last seen X ago"

#### Section 2: Trust Posture

Horizontal card with badge-style items in a flex row.

Items:
- Permission level badge (color-coded by level)
- Identity status: "Verified" (green) or "Unsigned" (gray)
- Signature: "Enforced" or "Optional"
- Active policies count (clickable — scrolls to policies section)
- Approval rate: "12 of 14 (86%)" with green/amber/red coloring based on ratio
- Blocks in last 30d: count with red highlight if > 0

#### Section 3: Active Signals (conditional)

Only renders if `signals.length > 0`. Hidden entirely when clean.

Card with count badge in header. Each signal rendered as:
- Severity dot (red/amber)
- Label text (bold)
- Detail text (muted)

Red signals sort first.

#### Section 4: Decision History

The main content section.

Header: "Decision History (count)" with inline filter controls.

Filters:
- Status: dropdown (all / running / completed / failed / blocked / pending_approval)
- Action type: dropdown
- Risk minimum: dropdown (any / 30+ / 50+ / 70+)
- Time range: dropdown (last 7d / 30d / 90d / all)

Table columns:
- Status badge (colored dot + label)
- Action type
- Declared goal (truncated to ~60 chars)
- Risk score (color-coded)
- Relative timestamp

Row expansion on click: shows full detail — reasoning, input/output summary, assumptions, artifacts, approval info, duration, cost, error message.

Defaults: excludes risk 0, last 30 days, 50 per page with "Load more" button.

Data source: `GET /api/actions?agent_id=X&exclude_status=...&risk_min=1&limit=50`

#### Section 5: Assumptions Track Record

Header: "Assumptions (count)" with summary bar showing validated/invalidated/unverified counts in colored badges.

Default view: 5 most notable assumptions, sorted by:
1. Invalidated (most recent first)
2. Unverified with highest drift score
3. Recently validated

Each row:
- Status icon: checkmark (green), X (red), circle (gray)
- Assumption text
- Basis text (muted)
- Age ("3d", "18d")
- Invalidated reason (if applicable)
- Drift score warning (if unverified and drift > 50)

"Show all" button loads remaining from `/api/assumptions?agent_id=X`.

#### Section 6: Policies

Header: "Policies (count active)"

Compact table:
- Policy type badge
- Description
- Scope badge: "global" (muted) or "agent" (brand color)

"Manage policies" button opens the existing policy assignment picker (reuse from current detail page).

### Components

New components (all in `app/agents/[agentId]/components/`):

- **AgentVitalsStrip.jsx** — Vitals strip with presence, name, stats
- **AgentTrustPosture.jsx** — Trust credential badges
- **AgentSignals.jsx** — Conditional signals list
- **AgentDecisionTable.jsx** — Filtered decision history table with expandable rows
- **AgentAssumptions.jsx** — Assumptions track record with summary bar
- **AgentPoliciesSection.jsx** — Compact policies list with manage button

Shared/reused:
- `Badge`, `Card`, `CardHeader`, `CardContent` from `app/components/ui/`
- `PageLayout` from `app/components/PageLayout.js`
- Existing policy picker component from current detail page

### Styling

Follow existing DashClaw conventions:
- Dark theme: `bg-[#0a0a0a]` page, `bg-[#111]` cards, `border-[rgba(255,255,255,0.08)]` borders
- Brand orange for accent: `text-brand`, `bg-brand/10`, `border-brand/30`
- Status colors: green (`text-emerald-400`), amber (`text-amber-400`), red (`text-red-400`)
- Monospace for IDs: `font-mono text-xs text-zinc-500`
- Section spacing: `space-y-6` between sections
- Cards: `rounded-2xl` or `rounded-3xl` matching existing pages

### Loading States

Each section shows a skeleton placeholder while its data loads:
- Vitals strip: horizontal skeleton bars
- Trust posture: badge-shaped skeleton blocks
- Decision table: row skeletons
- Assumptions: row skeletons

The profile endpoint provides enough data for sections 1-3 in a single call. Sections 4-5 load independently from their paginated endpoints.

### Error Handling

- Profile endpoint 404: show "Agent not found" empty state with link back to fleet
- Profile endpoint 500: show error card with retry button
- Decision/assumption fetches fail independently: show inline error with retry per section
- Each section is resilient — one failing section does not break the page

### Data Flow Summary

```
Page mount
  ├── GET /api/agents/[agentId]/profile  →  vitals + trust + signals + assumption summary
  ├── GET /api/actions?agent_id=X&...    →  decision history table
  └── GET /api/assumptions?agent_id=X    →  assumptions detail (deferred until "Show all")
```

## Non-Goals

- Real-time WebSocket updates for presence (polling on page load is sufficient)
- Token budget management UI (stays on existing page)
- Session detail views (stays on sessions page)
- Agent-to-agent message views (stays on messages page)
- Connection/integration management (stays on integrations page)
- Comparison view between agents (future feature)

## Files Changed

### New Files
- `app/api/agents/[agentId]/profile/route.js` — Profile aggregation endpoint
- `app/agents/[agentId]/components/AgentVitalsStrip.jsx`
- `app/agents/[agentId]/components/AgentTrustPosture.jsx`
- `app/agents/[agentId]/components/AgentSignals.jsx`
- `app/agents/[agentId]/components/AgentDecisionTable.jsx`
- `app/agents/[agentId]/components/AgentAssumptions.jsx`
- `app/agents/[agentId]/components/AgentPoliciesSection.jsx`
- `__tests__/unit/agent-profile-route.test.js`

### Modified Files
- `app/agents/[agentId]/page.js` — Replace current content with profile layout
- `app/lib/repositories/agents.repository.js` — Add `getAgentTrustPosture()`
- `app/lib/repositories/assumptions.repository.js` — Add `getAssumptionsSummary()`

### Unchanged
- `app/agents/page.js` — Fleet list stays the same, links to same `/agents/[agentId]`
- `app/components/Sidebar.js` — No nav changes needed
