# Operator Cockpit — Unified Operations Feed Design Spec

Date: 2026-04-08
Status: Approved
Roadmap: Operator Cockpit V1 — M1 (Unified Operations Feed)

## Goal

Replace Mission Control's fragmented activity split with a unified, severity-sorted operations feed so operators can answer "what needs attention?" from one place.

## Problem

Mission Control currently fetches 7 separate APIs and renders data across quadrants and two activity logs. Operators must mentally assemble the picture from scattered signals, approval queues, capability health cards, and activity streams. There's no single prioritized view of "what's wrong and what should I do about it."

## Approach

One new backend module aggregates items from existing data sources into a normalized feed. One new API route exposes the feed. Mission Control's 60/40 ActivityTimeline/SwarmActivityLog split is replaced with the unified feed. No new pages — Mission Control becomes the operator cockpit.

## Feed Item Model

Every item in the feed is normalized to a common shape:

```javascript
{
  id,                    // unique across sources (e.g., 'approval:act_123', 'signal:agent_silent:agent_1')
  category,              // 'approval' | 'failure' | 'signal' | 'health' | 'stale'
  severity,              // 'critical' | 'high' | 'medium' | 'low'
  title,                 // human-readable one-liner
  detail,                // supporting context (agent, system, error message)
  source,                // 'action' | 'signal' | 'capability' | 'integration' | 'loop'
  source_id,             // link back to source record
  agent_id,              // when attributable to an agent
  timestamp,             // ISO string for sort order
  action_url,            // where to go to resolve it (e.g., '/decisions/act_123')
  suggested_action,      // 'approve' | 'deny' | 'retry' | 'investigate' | 'disable' | null
}
```

## Data Sources and Severity Mapping

### Pending Approvals

Source: `action_records WHERE status = 'pending_approval'`
Category: `approval`
Severity: `high` if risk_score >= 70, otherwise `medium`
Title: `"Awaiting approval: {declared_goal}"`
Detail: agent_id, systems_touched, risk_score
Action URL: `/decisions/{action_id}`
Suggested action: `approve`

### Failed Actions (last 24h)

Source: `action_records WHERE status = 'failed' AND timestamp_start > 24h ago`
Category: `failure`
Severity: `high` if the same agent has 3+ failures in 24h (repeated), otherwise `medium`
Title: `"Failed: {declared_goal}"`
Detail: error_message, agent_id, duration_ms
Action URL: `/decisions/{action_id}`
Suggested action: `investigate`

### Risk Signals

Source: `computeSignals()` from `app/lib/signals.js`
Category: `signal`
Severity: `critical` if signal severity is `red`, `high` if `amber`
Title: signal label (already human-readable)
Detail: signal detail field
Action URL: depends on signal type — agent page, session page, or integration page
Suggested action: depends on type — `investigate` for most, `disable` for integration_mismatch

### Degraded/Failing Capabilities

Source: `GET /api/capabilities/health` where status is `degraded` or `failing`
Category: `health`
Severity: `critical` if status is `failing`, `high` if `degraded`
Title: `"Capability {name}: {status}"`
Detail: success_rate, recent_errors count, last successful invocation
Action URL: `/capabilities/{capability_id}`
Suggested action: `investigate` for degraded, `disable` for failing

### Degraded Integrations

Source: `checkAllIntegrations()` from `app/lib/integration-health.js`
Category: `health`
Severity: `high` if status is `error`, `medium` if `degraded`
Title: `"Integration {provider}: {status}"`
Detail: health message, last checked timestamp
Action URL: `/integrations`
Suggested action: `investigate`

### Stale Open Loops

Source: `open_loops WHERE status = 'open' AND created_at < 48h ago`
Category: `stale`
Severity: `medium`
Title: `"Stale dependency: {description}"`
Detail: loop_type, priority, age, linked action
Action URL: `/decisions/{action_id}` (linked action)
Suggested action: `investigate`

## Backend Module

### `app/lib/operations-feed.js`

Exports:

```javascript
export async function buildOperationsFeed(sql, orgId, filters = {})
```

Parameters:
- `filters.category` — optional, filter to one category
- `filters.severity` — optional, filter to one severity level
- `filters.limit` — default 50, max 200
- `filters.offset` — default 0

Returns:
```javascript
{
  items: [FeedItem, ...],        // sorted by severity (critical first) then timestamp (newest first)
  counts: {
    critical: number,
    high: number,
    medium: number,
    low: number,
    total: number,
  }
}
```

Implementation:
1. Fetch all 6 data sources in parallel using `Promise.all`
2. Normalize each result into feed items using source-specific mappers
3. Merge, sort by severity rank then timestamp descending
4. Apply category/severity filters
5. Apply limit/offset pagination
6. Compute counts from the pre-pagination merged list

Each data source has a dedicated mapper function:
- `mapApprovals(actions)` → FeedItem[]
- `mapFailures(actions)` → FeedItem[]
- `mapSignals(signals)` → FeedItem[]
- `mapCapabilityHealth(capabilities)` → FeedItem[]
- `mapIntegrationHealth(health)` → FeedItem[]
- `mapStaleLoops(loops)` → FeedItem[]

The mappers are pure functions — easy to test independently.

## API Route

### `GET /api/operations/feed`

Query params: `category`, `severity`, `limit`, `offset`

Response:
```json
{
  "items": [
    {
      "id": "approval:act_abc",
      "category": "approval",
      "severity": "high",
      "title": "Awaiting approval: Deploy to production",
      "detail": "agent: deploy-bot, risk: 85, systems: [production]",
      "source": "action",
      "source_id": "act_abc",
      "agent_id": "deploy-bot",
      "timestamp": "2026-04-08T14:30:00Z",
      "action_url": "/decisions/act_abc",
      "suggested_action": "approve"
    }
  ],
  "counts": {
    "critical": 1,
    "high": 3,
    "medium": 5,
    "low": 0,
    "total": 9
  }
}
```

## Mission Control Changes

### Remove
- `ActivityTimeline` component (the left 60% of the current activity split)
- `SwarmActivityLog` component (the right 40%)

### Add
- `OperationsFeed` component (full width, below the existing Command Strip and Signal Quadrants)

### OperationsFeed Component

Location: `app/mission-control/components/OperationsFeed.jsx`

Features:
- Fetches `/api/operations/feed` on mount and on 30s polling interval
- Filter bar: category pills (All, Approvals, Failures, Signals, Health, Stale) + severity dropdown
- Severity summary row: count badges for critical/high/medium/low
- Feed items as a vertical list
- Each item shows: severity dot (red/orange/yellow/blue), title, detail, age (relative time), agent badge, suggested action button
- Approval items have inline Approve/Deny buttons that POST to `/api/approvals/{actionId}`
- After approve/deny, remove the item from the feed and refresh counts
- Empty state: "All clear — no items need attention."

### Item Row Component

Location: `app/mission-control/components/OperationsFeedItem.jsx`

Renders one feed item with:
- Severity indicator (colored dot)
- Category pill
- Title (linked to action_url)
- Detail text
- Relative timestamp
- Agent badge (when present)
- Action button (Approve/Deny for approvals, "View" for others)

## Real-time Integration

The existing Mission Control page already subscribes to real-time events via `useRealtime()`. When `action.created`, `action.updated`, or `signal.detected` events arrive, trigger a feed refresh (debounced to avoid rapid re-fetches).

## Testing

### `__tests__/unit/operations-feed.test.js`

Test the pure mapper functions:
- `mapApprovals` correctly assigns severity based on risk_score
- `mapFailures` detects repeated failures and upgrades severity
- `mapSignals` maps red→critical and amber→high
- `mapCapabilityHealth` maps failing→critical and degraded→high
- `mapIntegrationHealth` maps error→high and degraded→medium
- `mapStaleLoops` assigns medium severity to loops older than 48h
- `buildOperationsFeed` sorts by severity then timestamp
- `buildOperationsFeed` respects category and severity filters
- `buildOperationsFeed` respects limit and offset

### `__tests__/unit/operations-feed-ui.test.jsx`

Test the OperationsFeed component:
- Renders feed items from mocked API response
- Filter by category shows only matching items
- Approval items render Approve/Deny buttons
- Empty state renders when no items

## Scope Boundaries

### In scope
- operations-feed.js module with mapper functions
- GET /api/operations/feed route
- OperationsFeed + OperationsFeedItem components
- Replace Mission Control activity split with the feed
- Inline approve/deny for approval items
- 30s polling + real-time event refresh

### Out of scope
- Snooze/dismiss/mute items
- Incident grouping or correlation
- Trend charts or time-series analytics
- New standalone /operations page
- Feed persistence or read/unread tracking
- SDK methods for the feed
