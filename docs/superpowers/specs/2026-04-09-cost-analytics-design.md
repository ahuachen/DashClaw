# Cost & Usage Analytics Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** New `/analytics` page showing cost, volume, and efficiency metrics.

## Problem

DashClaw tracks cost estimates, token usage, action durations, and policy enforcement decisions for every governed action — but none of this data is visualized. There's no way for an operator to answer "how much are my agents costing me?" or "what are the trends?" without querying the database directly.

## Goal

A single scrollable analytics page that shows the operational picture: cost trends, action volume, agent and action type breakdowns, policy enforcement stats, and token efficiency. All data already exists — this is a visualization layer.

## Design Decisions

- **Single scrollable page** — same pattern as Mission Control. No tabs. Data flows top-down from headlines to details.
- **Default 30-day window** with 7d/30d/90d toggle.
- **No new database tables.** All queries against existing `action_records`, `guard_decisions`, and `usage_meters`.
- **recharts** for charts (already installed v3.8.1).
- **One new API endpoint** (`GET /api/analytics`) that returns all data in a single call.

## Page Structure

### URL: `/analytics`

Added to Sidebar under "Measure" section (alongside Quality, Prompts, Feedback).

### Time Range Selector

Pill toggle in the page header actions area: `[7d] [30d] [90d]`, default 30d. Changing the range refetches all data.

### Section 1: Hero Stats Row

Four compact stat cards across the top in a responsive grid.

| Stat | Source | Calculation |
|------|--------|-------------|
| Total Cost | action_records | `SUM(cost_estimate)` in period |
| Actions | action_records | `COUNT(*)` in period |
| Active Agents | action_records | `COUNT(DISTINCT agent_id)` in period |
| Avg Latency | action_records | `AVG(duration_ms)` where status='completed' and duration_ms > 0 |

Each stat shows:
- Big number (formatted: cost as USD, actions as locale number, latency as seconds)
- Trend comparison vs previous equivalent period (30d → compare prior 30d)
- Green up-arrow or red down-arrow. Direction logic: more actions = green, more agents = green, lower cost = green, lower latency = green. Higher cost = red, higher latency = red.

### Section 2: Charts Row (2-column grid)

**Left: Cost Trend** — recharts `AreaChart`
- Daily cost over the selected period
- Soft gradient fill (brand orange, 10% opacity)
- Tooltip: date, cost, action count
- X-axis: dates. Y-axis: USD.
- Data: `SELECT DATE(timestamp_start) AS date, SUM(cost_estimate) AS cost, COUNT(*) AS actions FROM action_records WHERE org_id = $1 AND timestamp_start >= $2 GROUP BY DATE(timestamp_start) ORDER BY date`

**Right: Action Volume** — recharts `BarChart`
- Daily action counts stacked by status
- Colors: completed (emerald), failed (red), blocked (amber), other (zinc)
- Same date axis as cost trend
- Tooltip: date, total, breakdown by status
- Data: same query with `COUNT(*) FILTER (WHERE status = ...)` per status

### Section 3: Breakdowns Row (3-column grid)

**Card 1: By Agent**
- Top 5 agents ranked by cost descending
- Each row: agent name/id, cost amount, horizontal progress bar (% of total)
- "+N more" text at bottom if more than 5
- Data: `SELECT agent_id, agent_name, SUM(cost_estimate) AS cost, COUNT(*) AS actions FROM action_records WHERE ... GROUP BY agent_id, agent_name ORDER BY cost DESC LIMIT 5`
- Also needs total cost for percentage calculation

**Card 2: By Action Type**
- Top 5 action types ranked by cost descending
- Same row format: type name, cost, progress bar
- Data: `GROUP BY action_type`

**Card 3: Policy Enforcement**
- Counts from guard_decisions in the period: blocked, require_approval, warn
- Each row: decision type, count, progress bar (% of total decisions)
- Data: from existing `GET /api/guard/decisions` stats or direct query on guard_decisions

### Section 4: Token Usage

Full-width card at the bottom.

**Headline numbers (inline row):**
- Input tokens (30d): formatted as M/K
- Output tokens (30d): formatted as M/K
- Total tokens: formatted
- Efficiency: cost per million tokens (total cost / total tokens * 1M)

**Top 3 token consumers:**
- Agent name, total tokens, cost, average tokens per action
- Data: `SELECT agent_id, SUM(tokens_in + tokens_out) AS total_tokens, SUM(cost_estimate) AS cost, COUNT(*) AS actions FROM action_records WHERE ... AND (tokens_in > 0 OR tokens_out > 0) GROUP BY agent_id ORDER BY total_tokens DESC LIMIT 3`

## API Endpoint

### `GET /api/analytics`

Single endpoint returning all analytics data for the page.

**Query params:**
- `days` — 7, 30, or 90 (default 30)

**Response shape:**

```json
{
  "period": { "start": "2026-03-10", "end": "2026-04-09", "days": 30 },
  "hero": {
    "total_cost": 14.82,
    "total_actions": 4231,
    "active_agents": 23,
    "avg_latency_ms": 2100,
    "prev_cost": 13.20,
    "prev_actions": 3920,
    "prev_agents": 21,
    "prev_latency_ms": 2470
  },
  "daily": [
    { "date": "2026-03-10", "cost": 0.42, "actions": 120, "completed": 110, "failed": 5, "blocked": 3, "other": 2 }
  ],
  "by_agent": [
    { "agent_id": "moltfire", "agent_name": "MoltFire", "cost": 8.20, "actions": 1200, "pct": 55.3 }
  ],
  "by_action_type": [
    { "action_type": "deploy", "cost": 5.10, "actions": 340, "pct": 34.4 }
  ],
  "policy_enforcement": {
    "blocked": 47,
    "require_approval": 28,
    "warn": 15,
    "total": 90
  },
  "tokens": {
    "total_in": 2400000,
    "total_out": 890000,
    "total": 3290000,
    "cost_per_million": 4.49,
    "top_consumers": [
      { "agent_id": "moltfire", "agent_name": "MoltFire", "total_tokens": 1800000, "cost": 8.20, "actions": 1200, "avg_per_action": 1500 }
    ]
  }
}
```

**Implementation:** Single route file using repository functions. All queries run in parallel via `Promise.all`. Hero stats need two date ranges (current + previous) for comparison.

## Components

### New Files

| File | Responsibility |
|------|---------------|
| `app/analytics/page.jsx` | Page shell — fetches data, manages time range, renders sections |
| `app/analytics/components/HeroStats.jsx` | Four stat cards with trend comparison |
| `app/analytics/components/CostTrendChart.jsx` | Daily cost area chart (recharts) |
| `app/analytics/components/ActionVolumeChart.jsx` | Daily stacked bar chart (recharts) |
| `app/analytics/components/BreakdownCard.jsx` | Reusable ranked list with progress bars |
| `app/analytics/components/TokenUsage.jsx` | Token consumption summary |
| `app/api/analytics/route.js` | Analytics data aggregation endpoint |
| `app/lib/repositories/analytics.repository.js` | All analytics SQL queries |
| `__tests__/unit/analytics-route.test.js` | Tests for the analytics endpoint |

### Modified Files

| File | Change |
|------|--------|
| `app/components/Sidebar.js` | Add "Analytics" entry under Measure section |

## Styling

Follow existing DashClaw conventions:
- Dark theme, `bg-[#111]` cards, `border-[rgba(255,255,255,0.08)]`
- Brand orange for chart fills and accents
- Status colors: emerald (completed/positive), red (failed/negative), amber (blocked/warning)
- Stat cards use existing `Card` component pattern
- Progress bars: `rounded-full h-1.5` with `bg-brand` fill
- recharts theme: dark background, zinc grid lines, white text, brand-colored data

## Non-Goals

- Real-time streaming (page refreshes on time range change, no live updates)
- Export to CSV/PDF (future feature)
- Custom date range picker (7d/30d/90d presets are sufficient for v1)
- Per-action drill-down from charts (clicking a bar doesn't navigate anywhere)
- Budget vs actual comparison charts (token_budgets data exists but visualization is future scope)
