# Cost & Usage Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New `/analytics` page showing cost trends, action volume, agent/type breakdowns, policy enforcement stats, and token efficiency for the selected time window.

**Architecture:** A single `GET /api/analytics?days=30` endpoint aggregates all data in parallel from `action_records` and `guard_decisions`. The page is a client component with 5 stacked sections using recharts for visualization. SQL queries live in `analytics.repository.js`.

**Tech Stack:** Next.js 15 App Router, recharts 3.8.1 (already installed), Tailwind CSS, existing Card/Badge/Skeleton UI primitives.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/lib/repositories/analytics.repository.js` | All analytics SQL queries |
| `app/api/analytics/route.js` | Aggregation endpoint |
| `app/analytics/page.jsx` | Page shell with time range state |
| `app/analytics/components/HeroStats.jsx` | Four stat cards with trend comparison |
| `app/analytics/components/CostTrendChart.jsx` | Daily cost area chart |
| `app/analytics/components/ActionVolumeChart.jsx` | Daily stacked bar chart |
| `app/analytics/components/BreakdownCard.jsx` | Reusable ranked list with progress bars |
| `app/analytics/components/TokenUsage.jsx` | Token consumption summary |
| `__tests__/unit/analytics-route.test.js` | Tests for the analytics endpoint |

### Modified Files
| File | Change |
|------|--------|
| `app/components/Sidebar.js` | Add Analytics entry under Measure section |

---

### Task 1: Create analytics repository

**Files:**
- Create: `app/lib/repositories/analytics.repository.js`

- [ ] **Step 1: Create the repository**

```js
/**
 * Analytics repository — all queries for the /analytics page.
 */

export async function getAnalytics(sql, orgId, days = 30) {
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const prevStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000).toISOString();

  const safe = (promise) => promise.catch(() => [{}]);

  const [
    heroRows, prevHeroRows,
    dailyRows, dailyStatusRows,
    agentRows, typeRows,
    policyRows,
    tokenRows, tokenConsumerRows,
  ] = await Promise.all([
    // Current period hero stats
    safe(sql.query(
      `SELECT
        COALESCE(SUM(cost_estimate), 0)::real AS total_cost,
        COUNT(*)::int AS total_actions,
        COUNT(DISTINCT agent_id)::int AS active_agents,
        COALESCE(AVG(duration_ms) FILTER (WHERE status = 'completed' AND duration_ms > 0), 0)::int AS avg_latency_ms
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz`,
      [orgId, periodStart]
    )),

    // Previous period hero stats (for comparison)
    safe(sql.query(
      `SELECT
        COALESCE(SUM(cost_estimate), 0)::real AS total_cost,
        COUNT(*)::int AS total_actions,
        COUNT(DISTINCT agent_id)::int AS active_agents,
        COALESCE(AVG(duration_ms) FILTER (WHERE status = 'completed' AND duration_ms > 0), 0)::int AS avg_latency_ms
      FROM action_records
      WHERE org_id = $1
        AND timestamp_start::timestamptz >= $2::timestamptz
        AND timestamp_start::timestamptz < $3::timestamptz`,
      [orgId, prevStart, periodStart]
    )),

    // Daily cost trend
    safe(sql.query(
      `SELECT DATE(timestamp_start) AS date,
        COALESCE(SUM(cost_estimate), 0)::real AS cost,
        COUNT(*)::int AS actions
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz
      GROUP BY DATE(timestamp_start) ORDER BY date`,
      [orgId, periodStart]
    )),

    // Daily status breakdown
    safe(sql.query(
      `SELECT DATE(timestamp_start) AS date,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE status NOT IN ('completed','failed','blocked'))::int AS other
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz
      GROUP BY DATE(timestamp_start) ORDER BY date`,
      [orgId, periodStart]
    )),

    // Cost by agent (top 5)
    safe(sql.query(
      `SELECT agent_id, MAX(agent_name) AS agent_name,
        COALESCE(SUM(cost_estimate), 0)::real AS cost,
        COUNT(*)::int AS actions
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz
      GROUP BY agent_id ORDER BY cost DESC LIMIT 5`,
      [orgId, periodStart]
    )),

    // Cost by action type (top 5)
    safe(sql.query(
      `SELECT action_type,
        COALESCE(SUM(cost_estimate), 0)::real AS cost,
        COUNT(*)::int AS actions
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz
      GROUP BY action_type ORDER BY cost DESC LIMIT 5`,
      [orgId, periodStart]
    )),

    // Policy enforcement from guard_decisions
    safe(sql.query(
      `SELECT
        COUNT(*) FILTER (WHERE decision = 'block')::int AS blocked,
        COUNT(*) FILTER (WHERE decision = 'require_approval')::int AS require_approval,
        COUNT(*) FILTER (WHERE decision = 'warn')::int AS warn,
        COUNT(*)::int AS total
      FROM guard_decisions
      WHERE org_id = $1 AND created_at::timestamptz >= $2::timestamptz`,
      [orgId, periodStart]
    )),

    // Token totals
    safe(sql.query(
      `SELECT
        COALESCE(SUM(tokens_in), 0)::bigint AS total_in,
        COALESCE(SUM(tokens_out), 0)::bigint AS total_out,
        COALESCE(SUM(tokens_in) + SUM(tokens_out), 0)::bigint AS total,
        COALESCE(SUM(cost_estimate), 0)::real AS total_cost
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz
        AND (tokens_in > 0 OR tokens_out > 0)`,
      [orgId, periodStart]
    )),

    // Top token consumers (top 3)
    safe(sql.query(
      `SELECT agent_id, MAX(agent_name) AS agent_name,
        COALESCE(SUM(tokens_in) + SUM(tokens_out), 0)::bigint AS total_tokens,
        COALESCE(SUM(cost_estimate), 0)::real AS cost,
        COUNT(*)::int AS actions
      FROM action_records
      WHERE org_id = $1 AND timestamp_start::timestamptz >= $2::timestamptz
        AND (tokens_in > 0 OR tokens_out > 0)
      GROUP BY agent_id ORDER BY total_tokens DESC LIMIT 3`,
      [orgId, periodStart]
    )),
  ]);

  const hero = heroRows[0] || {};
  const prevHero = prevHeroRows[0] || {};
  const totalCost = parseFloat(hero.total_cost || 0);
  const tokenTotal = parseInt(tokenRows[0]?.total || '0', 10);
  const tokenTotalCost = parseFloat(tokenRows[0]?.total_cost || 0);

  // Merge daily cost + daily status into unified daily array
  const statusMap = new Map();
  for (const row of dailyStatusRows) {
    statusMap.set(String(row.date), row);
  }
  const daily = (dailyRows || []).map(row => {
    const s = statusMap.get(String(row.date)) || {};
    return {
      date: String(row.date),
      cost: Math.round(parseFloat(row.cost || 0) * 1000) / 1000,
      actions: parseInt(row.actions || '0', 10),
      completed: parseInt(s.completed || '0', 10),
      failed: parseInt(s.failed || '0', 10),
      blocked: parseInt(s.blocked || '0', 10),
      other: parseInt(s.other || '0', 10),
    };
  });

  // Calculate percentages for breakdowns
  const agentBreakdown = (agentRows || []).map(r => ({
    agent_id: r.agent_id,
    agent_name: r.agent_name || r.agent_id,
    cost: Math.round(parseFloat(r.cost || 0) * 1000) / 1000,
    actions: parseInt(r.actions || '0', 10),
    pct: totalCost > 0 ? Math.round((parseFloat(r.cost || 0) / totalCost) * 1000) / 10 : 0,
  }));

  const typeBreakdown = (typeRows || []).map(r => ({
    action_type: r.action_type,
    cost: Math.round(parseFloat(r.cost || 0) * 1000) / 1000,
    actions: parseInt(r.actions || '0', 10),
    pct: totalCost > 0 ? Math.round((parseFloat(r.cost || 0) / totalCost) * 1000) / 10 : 0,
  }));

  const policy = policyRows[0] || {};

  return {
    period: {
      start: periodStart.split('T')[0],
      end: now.toISOString().split('T')[0],
      days,
    },
    hero: {
      total_cost: Math.round(totalCost * 100) / 100,
      total_actions: parseInt(hero.total_actions || '0', 10),
      active_agents: parseInt(hero.active_agents || '0', 10),
      avg_latency_ms: parseInt(hero.avg_latency_ms || '0', 10),
      prev_cost: Math.round(parseFloat(prevHero.total_cost || 0) * 100) / 100,
      prev_actions: parseInt(prevHero.total_actions || '0', 10),
      prev_agents: parseInt(prevHero.active_agents || '0', 10),
      prev_latency_ms: parseInt(prevHero.avg_latency_ms || '0', 10),
    },
    daily,
    by_agent: agentBreakdown,
    by_action_type: typeBreakdown,
    policy_enforcement: {
      blocked: parseInt(policy.blocked || '0', 10),
      require_approval: parseInt(policy.require_approval || '0', 10),
      warn: parseInt(policy.warn || '0', 10),
      total: parseInt(policy.total || '0', 10),
    },
    tokens: {
      total_in: parseInt(tokenRows[0]?.total_in || '0', 10),
      total_out: parseInt(tokenRows[0]?.total_out || '0', 10),
      total: tokenTotal,
      cost_per_million: tokenTotal > 0 ? Math.round((tokenTotalCost / tokenTotal) * 1_000_000 * 100) / 100 : 0,
      top_consumers: (tokenConsumerRows || []).map(r => ({
        agent_id: r.agent_id,
        agent_name: r.agent_name || r.agent_id,
        total_tokens: parseInt(r.total_tokens || '0', 10),
        cost: Math.round(parseFloat(r.cost || 0) * 1000) / 1000,
        actions: parseInt(r.actions || '0', 10),
        avg_per_action: parseInt(r.actions || '0', 10) > 0 ? Math.round(parseInt(r.total_tokens || '0', 10) / parseInt(r.actions || '0', 10)) : 0,
      })),
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/repositories/analytics.repository.js
git commit -m "feat: add analytics repository with all aggregation queries"
```

---

### Task 2: Create analytics API endpoint + tests

**Files:**
- Create: `app/api/analytics/route.js`
- Create: `__tests__/unit/analytics-route.test.js`

- [ ] **Step 1: Create the route**

```js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { getOrgId } from '../../lib/org.js';
import { apiErrorResponse } from '../../lib/apiErrors.js';
import { getAnalytics } from '../../lib/repositories/analytics.repository.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 365);

    const data = await getAnalytics(sql, orgId, days);
    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, 'ANALYTICS');
  }
}
```

- [ ] **Step 2: Create the test file**

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const mockGetOrgId = vi.fn(() => 'org_test');
const mockSqlInstance = vi.fn();
const mockGetAnalytics = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/repositories/analytics.repository.js', () => ({
  getAnalytics: (...a) => mockGetAnalytics(...a),
}));

const { GET } = await import('../../app/api/analytics/route.js');

function getReq(params = '') {
  return makeRequest(`http://localhost:3000/api/analytics${params}`, {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

describe('GET /api/analytics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns analytics data with default 30 days', async () => {
    const mockData = {
      period: { start: '2026-03-10', end: '2026-04-09', days: 30 },
      hero: { total_cost: 14.82, total_actions: 4231, active_agents: 23, avg_latency_ms: 2100, prev_cost: 13.20, prev_actions: 3920, prev_agents: 21, prev_latency_ms: 2470 },
      daily: [],
      by_agent: [],
      by_action_type: [],
      policy_enforcement: { blocked: 0, require_approval: 0, warn: 0, total: 0 },
      tokens: { total_in: 0, total_out: 0, total: 0, cost_per_million: 0, top_consumers: [] },
    };
    mockGetAnalytics.mockResolvedValueOnce(mockData);

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hero.total_cost).toBe(14.82);
    expect(data.hero.total_actions).toBe(4231);
    expect(mockGetAnalytics).toHaveBeenCalledWith(expect.anything(), 'org_test', 30);
  });

  it('passes custom days parameter', async () => {
    mockGetAnalytics.mockResolvedValueOnce({ period: {}, hero: {}, daily: [], by_agent: [], by_action_type: [], policy_enforcement: {}, tokens: {} });

    await GET(getReq('?days=7'));

    expect(mockGetAnalytics).toHaveBeenCalledWith(expect.anything(), 'org_test', 7);
  });

  it('clamps days to 1-365', async () => {
    mockGetAnalytics.mockResolvedValueOnce({ period: {}, hero: {}, daily: [], by_agent: [], by_action_type: [], policy_enforcement: {}, tokens: {} });

    await GET(getReq('?days=999'));

    expect(mockGetAnalytics).toHaveBeenCalledWith(expect.anything(), 'org_test', 365);
  });

  it('returns 500 on error', async () => {
    mockGetAnalytics.mockRejectedValueOnce(new Error('DB down'));

    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run __tests__/unit/analytics-route.test.js
npx vitest run
git add app/api/analytics/route.js __tests__/unit/analytics-route.test.js
git commit -m "feat: add GET /api/analytics endpoint"
```

---

### Task 3: Build HeroStats component

**Files:**
- Create: `app/analytics/components/HeroStats.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCost, formatTokens } from '../../lib/formatCost';

function TrendBadge({ current, previous, invert = false }) {
  if (!previous || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  // invert: for cost/latency, lower is better (green); for actions/agents, higher is better (green)
  const isPositive = invert ? pct < 0 : pct > 0;
  const color = isPositive ? 'text-emerald-400' : 'text-red-400';
  const Icon = pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon size={12} /> {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

function StatCard({ label, value, trend }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-4">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white">{value}</span>
        {trend}
      </div>
    </div>
  );
}

export default function HeroStats({ hero }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Cost"
        value={formatCost(hero.total_cost)}
        trend={<TrendBadge current={hero.total_cost} previous={hero.prev_cost} invert />}
      />
      <StatCard
        label="Actions"
        value={(hero.total_actions || 0).toLocaleString()}
        trend={<TrendBadge current={hero.total_actions} previous={hero.prev_actions} />}
      />
      <StatCard
        label="Active Agents"
        value={hero.active_agents || 0}
        trend={<TrendBadge current={hero.active_agents} previous={hero.prev_agents} />}
      />
      <StatCard
        label="Avg Latency"
        value={hero.avg_latency_ms > 0 ? `${(hero.avg_latency_ms / 1000).toFixed(1)}s` : '—'}
        trend={<TrendBadge current={hero.avg_latency_ms} previous={hero.prev_latency_ms} invert />}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/analytics/components/HeroStats.jsx
git commit -m "feat: add HeroStats component with trend comparison"
```

---

### Task 4: Build CostTrendChart and ActionVolumeChart

**Files:**
- Create: `app/analytics/components/CostTrendChart.jsx`
- Create: `app/analytics/components/ActionVolumeChart.jsx`

- [ ] **Step 1: Create the cost trend chart**

```jsx
'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400">{d.date}</div>
      <div className="text-white font-medium">${d.cost?.toFixed(2)}</div>
      <div className="text-zinc-500">{d.actions} actions</div>
    </div>
  );
}

export default function CostTrendChart({ daily }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">Cost Trend</div>
      {daily.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-zinc-500">No cost data in this period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="cost" stroke="#f97316" fill="url(#costGradient)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the action volume chart**

```jsx
'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400 mb-1">{d.date}</div>
      <div className="text-emerald-400">Completed: {d.completed}</div>
      <div className="text-red-400">Failed: {d.failed}</div>
      <div className="text-amber-400">Blocked: {d.blocked}</div>
      <div className="text-zinc-400">Other: {d.other}</div>
    </div>
  );
}

export default function ActionVolumeChart({ daily }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">Action Volume</div>
      {daily.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-zinc-500">No actions in this period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="completed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" />
            <Bar dataKey="blocked" stackId="a" fill="#eab308" />
            <Bar dataKey="other" stackId="a" fill="#52525b" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/analytics/components/CostTrendChart.jsx app/analytics/components/ActionVolumeChart.jsx
git commit -m "feat: add CostTrendChart and ActionVolumeChart components"
```

---

### Task 5: Build BreakdownCard and TokenUsage components

**Files:**
- Create: `app/analytics/components/BreakdownCard.jsx`
- Create: `app/analytics/components/TokenUsage.jsx`

- [ ] **Step 1: Create the breakdown card**

```jsx
import { formatCost } from '../../lib/formatCost';

export default function BreakdownCard({ title, items, labelKey, countLabel }) {
  const maxPct = Math.max(...items.map(i => i.pct || 0), 1);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-zinc-500">No data in this period.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item[labelKey] || i}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300 truncate">{item[labelKey]}</span>
                <span className="text-zinc-400 shrink-0 ml-2">
                  {countLabel === 'cost' ? formatCost(item.cost) : item[countLabel] || 0}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5">
                <div
                  className="h-1.5 rounded-full bg-brand transition-all"
                  style={{ width: `${Math.max((item.pct / maxPct) * 100, 2)}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{item.pct}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the token usage component**

```jsx
import { formatCost, formatTokens } from '../../lib/formatCost';

export default function TokenUsage({ tokens }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">Token Usage</div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div>
          <div className="text-[10px] text-zinc-500">Input Tokens</div>
          <div className="text-lg font-semibold text-white">{formatTokens(tokens.total_in)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Output Tokens</div>
          <div className="text-lg font-semibold text-white">{formatTokens(tokens.total_out)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Total</div>
          <div className="text-lg font-semibold text-white">{formatTokens(tokens.total)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Cost / 1M Tokens</div>
          <div className="text-lg font-semibold text-white">{formatCost(tokens.cost_per_million)}</div>
        </div>
      </div>

      {tokens.top_consumers?.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Top Consumers</div>
          <div className="space-y-2">
            {tokens.top_consumers.map(c => (
              <div key={c.agent_id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{c.agent_name || c.agent_id}</span>
                <span className="text-zinc-400">
                  {formatTokens(c.total_tokens)} tokens &middot; {formatCost(c.cost)} &middot; avg {formatTokens(c.avg_per_action)}/action
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/analytics/components/BreakdownCard.jsx app/analytics/components/TokenUsage.jsx
git commit -m "feat: add BreakdownCard and TokenUsage components"
```

---

### Task 6: Build the analytics page

**Files:**
- Create: `app/analytics/page.jsx`

- [ ] **Step 1: Create the page**

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import PageLayout from '../components/PageLayout';
import { Skeleton } from '../components/ui/Skeleton';
import HeroStats from './components/HeroStats';
import CostTrendChart from './components/CostTrendChart';
import ActionVolumeChart from './components/ActionVolumeChart';
import BreakdownCard from './components/BreakdownCard';
import TokenUsage from './components/TokenUsage';

const RANGES = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const policyItems = data ? [
    { label: 'Blocked', count: data.policy_enforcement.blocked, pct: data.policy_enforcement.total > 0 ? Math.round((data.policy_enforcement.blocked / data.policy_enforcement.total) * 1000) / 10 : 0 },
    { label: 'Approvals', count: data.policy_enforcement.require_approval, pct: data.policy_enforcement.total > 0 ? Math.round((data.policy_enforcement.require_approval / data.policy_enforcement.total) * 1000) / 10 : 0 },
    { label: 'Warnings', count: data.policy_enforcement.warn, pct: data.policy_enforcement.total > 0 ? Math.round((data.policy_enforcement.warn / data.policy_enforcement.total) * 1000) / 10 : 0 },
  ] : [];

  return (
    <PageLayout
      title="Analytics"
      subtitle="Cost, usage, and efficiency metrics"
      breadcrumbs={['Measure', 'Analytics']}
      maturity="beta"
      actions={
        <div className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-surface-tertiary p-0.5">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                days === r.value ? 'bg-brand/15 text-brand' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <HeroStats hero={data.hero} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CostTrendChart daily={data.daily} />
            <ActionVolumeChart daily={data.daily} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BreakdownCard
              title="By Agent"
              items={data.by_agent}
              labelKey="agent_name"
              countLabel="cost"
            />
            <BreakdownCard
              title="By Action Type"
              items={data.by_action_type}
              labelKey="action_type"
              countLabel="cost"
            />
            <BreakdownCard
              title="Policy Enforcement"
              items={policyItems}
              labelKey="label"
              countLabel="count"
            />
          </div>

          <TokenUsage tokens={data.tokens} />
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-zinc-500">Failed to load analytics data.</div>
      )}
    </PageLayout>
  );
}
```

- [ ] **Step 2: Run full test suite and lint**

```bash
npx vitest run
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add app/analytics/page.jsx
git commit -m "feat: add analytics page with charts and breakdowns"
```

---

### Task 7: Add sidebar entry + final integration

**Files:**
- Modify: `app/components/Sidebar.js`

- [ ] **Step 1: Add Analytics to sidebar**

Read `app/components/Sidebar.js` and find the Measure section. Add Analytics entry with the `TrendingUp` icon (already imported in the file — verify first). Add it as the first item in the Measure group:

```js
// In the Measure section items array, add as first entry:
{ href: '/analytics', icon: TrendingUp, label: 'Analytics' },
```

If `TrendingUp` is not already imported, add it to the lucide-react import.

- [ ] **Step 2: Run full test suite, lint, route-sql check**

```bash
npx vitest run
npm run lint
npm run route-sql:check
```

- [ ] **Step 3: Commit**

```bash
git add app/components/Sidebar.js
git commit -m "feat: add Analytics to sidebar under Measure section"
```

- [ ] **Step 4: Commit spec + plan docs**

```bash
git add docs/superpowers/specs/2026-04-09-cost-analytics-design.md docs/superpowers/plans/2026-04-09-cost-analytics.md
git commit -m "docs: add cost analytics design spec and implementation plan"
```
