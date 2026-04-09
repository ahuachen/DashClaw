# Operator Cockpit — Unified Operations Feed Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mission Control's fragmented activity split with a unified, severity-sorted operations feed that aggregates approvals, failures, signals, health, and stale items.

**Architecture:** One new backend module (`operations-feed.js`) with pure mapper functions that normalize items from 6 data sources. One new API route. Two new UI components replace the current ActivityTimeline/SwarmActivityLog split on Mission Control.

**Tech Stack:** Next.js 15 App Router, Postgres via postgres.js, Vitest + jsdom, existing DashClaw UI primitives

---

## File Map

### New files to create

- `app/lib/operations-feed.js` — pure mapper functions + buildOperationsFeed orchestrator
- `app/api/operations/feed/route.js` — GET endpoint
- `app/mission-control/components/OperationsFeed.jsx` — feed container with filters
- `app/mission-control/components/OperationsFeedItem.jsx` — single feed item row
- `__tests__/unit/operations-feed.test.js` — mapper + orchestrator tests
- `__tests__/unit/operations-feed-ui.test.jsx` — component tests

### Existing files to modify

- `app/mission-control/page.js` — replace BAND 3 activity split with OperationsFeed

### Existing files to leave alone

- `app/lib/signals.js` — consumed as-is
- `app/lib/capability-health.js` — consumed as-is
- `app/lib/integration-health.js` — consumed as-is
- `app/components/ActivityTimeline.js` — not deleted, just no longer used by Mission Control
- `app/components/SwarmActivityLog.js` — not deleted, just no longer used by Mission Control

---

## Chunk 1: Feed Aggregation Module

### Task 1: Write failing tests for mapper functions

**Files:**
- Create: `__tests__/unit/operations-feed.test.js`

- [ ] **Step 1: Write mapper tests**

Create `__tests__/unit/operations-feed.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import {
  mapApprovals,
  mapFailures,
  mapSignals,
  mapCapabilityHealth,
  mapIntegrationHealth,
  mapStaleLoops,
  SEVERITY_RANK,
} from '../../app/lib/operations-feed.js';

describe('mapApprovals', () => {
  it('maps pending approval to feed item with high severity when risk >= 70', () => {
    const items = mapApprovals([{
      action_id: 'act_1',
      agent_id: 'deploy-bot',
      declared_goal: 'Deploy to production',
      risk_score: 85,
      systems_touched: '["production"]',
      timestamp_start: '2026-04-08T14:00:00Z',
    }]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'approval:act_1',
      category: 'approval',
      severity: 'high',
      title: 'Awaiting approval: Deploy to production',
      source: 'action',
      source_id: 'act_1',
      agent_id: 'deploy-bot',
      suggested_action: 'approve',
    });
  });

  it('assigns medium severity when risk < 70', () => {
    const items = mapApprovals([{
      action_id: 'act_2',
      agent_id: 'helper',
      declared_goal: 'Log summary',
      risk_score: 30,
      timestamp_start: '2026-04-08T14:00:00Z',
    }]);

    expect(items[0].severity).toBe('medium');
  });
});

describe('mapFailures', () => {
  it('marks agent with 3+ failures as high severity', () => {
    const actions = [
      { action_id: 'act_1', agent_id: 'bot_1', declared_goal: 'Task 1', error_message: 'err', timestamp_start: '2026-04-08T14:00:00Z' },
      { action_id: 'act_2', agent_id: 'bot_1', declared_goal: 'Task 2', error_message: 'err', timestamp_start: '2026-04-08T13:00:00Z' },
      { action_id: 'act_3', agent_id: 'bot_1', declared_goal: 'Task 3', error_message: 'err', timestamp_start: '2026-04-08T12:00:00Z' },
    ];

    const items = mapFailures(actions);
    expect(items[0].severity).toBe('high');
  });

  it('marks single failure as medium severity', () => {
    const items = mapFailures([{
      action_id: 'act_1',
      agent_id: 'bot_2',
      declared_goal: 'One-off fail',
      error_message: 'timeout',
      timestamp_start: '2026-04-08T14:00:00Z',
    }]);

    expect(items[0].severity).toBe('medium');
  });
});

describe('mapSignals', () => {
  it('maps red signal to critical severity', () => {
    const items = mapSignals([{
      type: 'session_stalled',
      severity: 'red',
      label: 'Session stalled: agent-1',
      detail: 'No activity for 4h',
      agent_id: 'agent-1',
    }]);

    expect(items[0].severity).toBe('critical');
    expect(items[0].category).toBe('signal');
  });

  it('maps amber signal to high severity', () => {
    const items = mapSignals([{
      type: 'autonomy_spike',
      severity: 'amber',
      label: 'Autonomy spike: bot-1',
      detail: '15 ungoverned actions/hour',
      agent_id: 'bot-1',
    }]);

    expect(items[0].severity).toBe('high');
  });
});

describe('mapCapabilityHealth', () => {
  it('maps failing capability to critical severity', () => {
    const items = mapCapabilityHealth([{
      capability_id: 'cap_1',
      name: 'Research API',
      status: 'failing',
      success_rate_1d: 0.12,
      recent_errors: [{}, {}, {}],
    }]);

    expect(items[0]).toMatchObject({
      category: 'health',
      severity: 'critical',
      source: 'capability',
      suggested_action: 'disable',
    });
  });

  it('maps degraded capability to high severity', () => {
    const items = mapCapabilityHealth([{
      capability_id: 'cap_2',
      name: 'Email API',
      status: 'degraded',
      success_rate_1d: 0.75,
    }]);

    expect(items[0].severity).toBe('high');
    expect(items[0].suggested_action).toBe('investigate');
  });

  it('skips healthy capabilities', () => {
    const items = mapCapabilityHealth([{ capability_id: 'cap_3', name: 'OK API', status: 'healthy' }]);
    expect(items).toHaveLength(0);
  });
});

describe('mapIntegrationHealth', () => {
  it('maps error integration to high severity', () => {
    const items = mapIntegrationHealth({
      openai: { status: 'error', message: 'Invalid API key', checked_at: '2026-04-08T14:00:00Z' },
    });

    expect(items[0]).toMatchObject({
      category: 'health',
      severity: 'high',
      source: 'integration',
      suggested_action: 'investigate',
    });
  });

  it('skips healthy and not_configured integrations', () => {
    const items = mapIntegrationHealth({
      openai: { status: 'healthy' },
      stripe: { status: 'not_configured' },
    });

    expect(items).toHaveLength(0);
  });
});

describe('mapStaleLoops', () => {
  it('maps stale open loop to medium severity', () => {
    const items = mapStaleLoops([{
      loop_id: 'loop_1',
      description: 'Awaiting data review',
      priority: 'medium',
      loop_type: 'dependency',
      created_at: '2026-04-06T10:00:00Z',
      action_id: 'act_1',
    }]);

    expect(items[0]).toMatchObject({
      category: 'stale',
      severity: 'medium',
      source: 'loop',
      suggested_action: 'investigate',
    });
  });
});

describe('SEVERITY_RANK', () => {
  it('ranks critical < high < medium < low', () => {
    expect(SEVERITY_RANK.critical).toBeLessThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeLessThan(SEVERITY_RANK.medium);
    expect(SEVERITY_RANK.medium).toBeLessThan(SEVERITY_RANK.low);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/operations-feed.test.js`
Expected: FAIL because module does not exist

- [ ] **Step 3: Commit test file**

```bash
git add __tests__/unit/operations-feed.test.js
git commit -m "test: add operations feed mapper tests"
```

---

### Task 2: Implement the operations feed module

**Files:**
- Create: `app/lib/operations-feed.js`

- [ ] **Step 1: Implement all mapper functions and the orchestrator**

Create `app/lib/operations-feed.js`:

```javascript
/**
 * Operations feed aggregation.
 * Pure mapper functions normalize items from 6 data sources into a unified feed.
 */

import { computeSignals } from './signals.js';
import { checkAllIntegrations } from './integration-health.js';

export const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Mappers ───────────────────────────────────────────────────

export function mapApprovals(actions) {
  return (actions || []).map((a) => ({
    id: `approval:${a.action_id}`,
    category: 'approval',
    severity: (a.risk_score || 0) >= 70 ? 'high' : 'medium',
    title: `Awaiting approval: ${a.declared_goal || a.action_type || 'Unknown action'}`,
    detail: [
      a.agent_id && `agent: ${a.agent_id}`,
      a.risk_score != null && `risk: ${a.risk_score}`,
      a.systems_touched && `systems: ${a.systems_touched}`,
    ].filter(Boolean).join(', '),
    source: 'action',
    source_id: a.action_id,
    agent_id: a.agent_id || null,
    timestamp: a.timestamp_start || a.created_at || new Date().toISOString(),
    action_url: `/decisions/${a.action_id}`,
    suggested_action: 'approve',
  }));
}

export function mapFailures(actions) {
  // Count failures per agent to detect repeated failures
  const agentFailureCounts = {};
  for (const a of (actions || [])) {
    const id = a.agent_id || 'unknown';
    agentFailureCounts[id] = (agentFailureCounts[id] || 0) + 1;
  }

  return (actions || []).map((a) => {
    const agentCount = agentFailureCounts[a.agent_id || 'unknown'] || 1;
    return {
      id: `failure:${a.action_id}`,
      category: 'failure',
      severity: agentCount >= 3 ? 'high' : 'medium',
      title: `Failed: ${a.declared_goal || a.action_type || 'Unknown action'}`,
      detail: [
        a.error_message,
        a.agent_id && `agent: ${a.agent_id}`,
        a.duration_ms != null && `${a.duration_ms}ms`,
      ].filter(Boolean).join(', '),
      source: 'action',
      source_id: a.action_id,
      agent_id: a.agent_id || null,
      timestamp: a.timestamp_start || a.created_at || new Date().toISOString(),
      action_url: `/decisions/${a.action_id}`,
      suggested_action: 'investigate',
    };
  });
}

export function mapSignals(signals) {
  return (signals || []).map((s) => ({
    id: `signal:${s.type || s.signal_type}:${s.agent_id || 'system'}:${s.action_id || s.loop_id || s.assumption_id || ''}`,
    category: 'signal',
    severity: s.severity === 'red' ? 'critical' : 'high',
    title: s.label || `${s.type || s.signal_type}: ${s.agent_id || 'system'}`,
    detail: s.detail || '',
    source: 'signal',
    source_id: s.action_id || s.loop_id || s.assumption_id || null,
    agent_id: s.agent_id || null,
    timestamp: s.detected_at || new Date().toISOString(),
    action_url: s.agent_id ? `/agents/${encodeURIComponent(s.agent_id)}` : '/security',
    suggested_action: s.type === 'integration_mismatch' ? 'disable' : 'investigate',
  }));
}

export function mapCapabilityHealth(capabilities) {
  return (capabilities || [])
    .filter((c) => c.status === 'failing' || c.status === 'degraded')
    .map((c) => ({
      id: `cap_health:${c.capability_id}`,
      category: 'health',
      severity: c.status === 'failing' ? 'critical' : 'high',
      title: `Capability ${c.name}: ${c.status}`,
      detail: [
        c.success_rate_1d != null && `success rate: ${Math.round(c.success_rate_1d * 100)}%`,
        c.recent_errors?.length && `${c.recent_errors.length} recent errors`,
      ].filter(Boolean).join(', '),
      source: 'capability',
      source_id: c.capability_id,
      agent_id: null,
      timestamp: c.last_invocation || new Date().toISOString(),
      action_url: `/capabilities/${c.capability_id}`,
      suggested_action: c.status === 'failing' ? 'disable' : 'investigate',
    }));
}

export function mapIntegrationHealth(healthMap) {
  return Object.entries(healthMap || {})
    .filter(([, h]) => h.status === 'error' || h.status === 'degraded')
    .map(([provider, h]) => ({
      id: `int_health:${provider}`,
      category: 'health',
      severity: h.status === 'error' ? 'high' : 'medium',
      title: `Integration ${provider}: ${h.status}`,
      detail: h.message || '',
      source: 'integration',
      source_id: provider,
      agent_id: null,
      timestamp: h.checked_at || new Date().toISOString(),
      action_url: '/integrations',
      suggested_action: 'investigate',
    }));
}

export function mapStaleLoops(loops) {
  return (loops || []).map((l) => ({
    id: `stale_loop:${l.loop_id}`,
    category: 'stale',
    severity: 'medium',
    title: `Stale dependency: ${l.description || l.loop_type || 'Open loop'}`,
    detail: [
      l.loop_type && `type: ${l.loop_type}`,
      l.priority && `priority: ${l.priority}`,
    ].filter(Boolean).join(', '),
    source: 'loop',
    source_id: l.loop_id,
    agent_id: l.agent_id || null,
    timestamp: l.created_at || new Date().toISOString(),
    action_url: l.action_id ? `/decisions/${l.action_id}` : '/dashboard',
    suggested_action: 'investigate',
  }));
}

// ─── Orchestrator ──────────────────────────────────────────────

export async function buildOperationsFeed(sql, orgId, filters = {}) {
  const { category, severity, limit = 50, offset = 0 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  // Fetch all data sources in parallel
  const [pendingRows, failedRows, signalResult, capHealthRows, integrationHealth, staleLoopRows] = await Promise.all([
    sql`
      SELECT action_id, agent_id, declared_goal, risk_score, systems_touched, timestamp_start, created_at
      FROM action_records
      WHERE org_id = ${orgId} AND status = 'pending_approval'
      ORDER BY timestamp_start::timestamptz DESC
      LIMIT 50
    `,
    sql`
      SELECT action_id, agent_id, declared_goal, error_message, duration_ms, timestamp_start, created_at
      FROM action_records
      WHERE org_id = ${orgId} AND status = 'failed'
        AND timestamp_start::timestamptz > NOW() - INTERVAL '24 hours'
      ORDER BY timestamp_start::timestamptz DESC
      LIMIT 50
    `,
    computeSignals(orgId, null, sql).catch(() => []),
    sql`
      SELECT capability_id, name, status, success_rate_1d, recent_errors, last_invocation
      FROM (
        SELECT c.capability_id, c.name,
          CASE
            WHEN COUNT(CASE WHEN ar.status = 'failed' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.5 THEN 'failing'
            WHEN COUNT(CASE WHEN ar.status = 'failed' THEN 1 END)::float / NULLIF(COUNT(*), 0) > 0.2 THEN 'degraded'
            ELSE 'healthy'
          END AS status,
          1.0 - (COUNT(CASE WHEN ar.status = 'failed' THEN 1 END)::float / NULLIF(COUNT(*), 0)) AS success_rate_1d,
          NULL AS recent_errors,
          MAX(ar.timestamp_start) AS last_invocation
        FROM capabilities c
        LEFT JOIN action_records ar ON ar.systems_touched::text LIKE '%capability:' || c.slug || '%'
          AND ar.org_id = ${orgId}
          AND ar.timestamp_start::timestamptz > NOW() - INTERVAL '24 hours'
        WHERE c.org_id = ${orgId}
        GROUP BY c.capability_id, c.name
      ) sub
      WHERE status IN ('failing', 'degraded')
    `.catch(() => []),
    checkAllIntegrations(orgId, sql).catch(() => ({})),
    sql`
      SELECT ol.loop_id, ol.description, ol.priority, ol.loop_type, ol.created_at, ol.action_id, ar.agent_id
      FROM open_loops ol
      LEFT JOIN action_records ar ON ol.action_id = ar.action_id
      WHERE ol.status = 'open' AND ol.org_id = ${orgId}
        AND ol.created_at < NOW() - INTERVAL '48 hours'
      ORDER BY ol.created_at ASC
      LIMIT 20
    `,
  ]);

  // Map all sources to feed items
  const signals = Array.isArray(signalResult) ? signalResult : (signalResult?.signals || []);
  let allItems = [
    ...mapApprovals(pendingRows),
    ...mapFailures(failedRows),
    ...mapSignals(signals),
    ...mapCapabilityHealth(capHealthRows),
    ...mapIntegrationHealth(integrationHealth),
    ...mapStaleLoops(staleLoopRows),
  ];

  // Apply filters
  if (category) {
    allItems = allItems.filter((item) => item.category === category);
  }
  if (severity) {
    allItems = allItems.filter((item) => item.severity === severity);
  }

  // Count before pagination
  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: allItems.length };
  for (const item of allItems) {
    counts[item.severity] = (counts[item.severity] || 0) + 1;
  }

  // Sort: severity rank ASC (critical first), then timestamp DESC (newest first)
  allItems.sort((a, b) => {
    const sevDiff = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Paginate
  const items = allItems.slice(parsedOffset, parsedOffset + parsedLimit);

  return { items, counts };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/operations-feed.test.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/lib/operations-feed.js __tests__/unit/operations-feed.test.js
git commit -m "feat: add operations feed aggregation module"
```

---

## Chunk 2: API Route

### Task 3: Add the operations feed API route

**Files:**
- Create: `app/api/operations/feed/route.js`

- [ ] **Step 1: Create the route**

Create `app/api/operations/feed/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';
import { buildOperationsFeed } from '../../../lib/operations-feed.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const filters = {
      category: searchParams.get('category') || undefined,
      severity: searchParams.get('severity') || undefined,
      limit: searchParams.get('limit') || 50,
      offset: searchParams.get('offset') || 0,
    };

    const result = await buildOperationsFeed(sql, orgId, filters);

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error, 'OPERATIONS_FEED');
  }
}
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/api/operations/feed/route.js
git commit -m "feat: add operations feed API route"
```

---

## Chunk 3: UI Components

### Task 4: Build the OperationsFeedItem component

**Files:**
- Create: `app/mission-control/components/OperationsFeedItem.jsx`

- [ ] **Step 1: Create the feed item component**

Create `app/mission-control/components/OperationsFeedItem.jsx`:

```jsx
'use client';

import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, ShieldAlert, Activity, Clock } from 'lucide-react';

const SEVERITY_DOT = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

const CATEGORY_PILL = {
  approval: { label: 'Approval', color: 'bg-purple-400/10 text-purple-400 border-purple-400/20' },
  failure: { label: 'Failure', color: 'bg-red-400/10 text-red-400 border-red-400/20' },
  signal: { label: 'Signal', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  health: { label: 'Health', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  stale: { label: 'Stale', color: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20' },
};

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export default function OperationsFeedItem({ item, onApprove, onDeny }) {
  const dot = SEVERITY_DOT[item.severity] || SEVERITY_DOT.low;
  const pill = CATEGORY_PILL[item.category] || CATEGORY_PILL.signal;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${pill.color}`}>
            {pill.label}
          </span>
          {item.agent_id && (
            <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">{item.agent_id}</span>
          )}
          <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">{formatRelativeTime(item.timestamp)}</span>
        </div>

        <Link href={item.action_url || '#'} className="text-sm text-zinc-200 hover:text-white transition-colors">
          {item.title}
        </Link>

        {item.detail && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.detail}</p>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 mt-1">
        {item.category === 'approval' && onApprove && onDeny && (
          <>
            <button
              onClick={() => onApprove(item.source_id)}
              className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onDeny(item.source_id)}
              className="px-2 py-1 rounded text-[10px] font-medium bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors"
            >
              Deny
            </button>
          </>
        )}
        {item.category !== 'approval' && (
          <Link
            href={item.action_url || '#'}
            className="px-2 py-1 rounded text-[10px] font-medium bg-white/5 text-zinc-400 border border-[rgba(255,255,255,0.08)] hover:bg-white/10 transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/mission-control/components/OperationsFeedItem.jsx
git commit -m "feat: add operations feed item component"
```

---

### Task 5: Build the OperationsFeed container component

**Files:**
- Create: `app/mission-control/components/OperationsFeed.jsx`
- Create: `__tests__/unit/operations-feed-ui.test.jsx`

- [ ] **Step 1: Write failing UI tests**

Create `__tests__/unit/operations-feed-ui.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OperationsFeed from '../../app/mission-control/components/OperationsFeed.jsx';

function okJson(data) {
  return { ok: true, status: 200, json: async () => data };
}

const mockFeed = {
  items: [
    {
      id: 'approval:act_1',
      category: 'approval',
      severity: 'high',
      title: 'Awaiting approval: Deploy to prod',
      detail: 'agent: deploy-bot, risk: 85',
      source: 'action',
      source_id: 'act_1',
      agent_id: 'deploy-bot',
      timestamp: '2026-04-08T14:00:00Z',
      action_url: '/decisions/act_1',
      suggested_action: 'approve',
    },
    {
      id: 'signal:session_stalled:agent-1',
      category: 'signal',
      severity: 'critical',
      title: 'Session stalled: agent-1',
      detail: 'No activity for 4h',
      source: 'signal',
      source_id: null,
      agent_id: 'agent-1',
      timestamp: '2026-04-08T13:00:00Z',
      action_url: '/agents/agent-1',
      suggested_action: 'investigate',
    },
  ],
  counts: { critical: 1, high: 1, medium: 0, low: 0, total: 2 },
};

describe('OperationsFeed', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders feed items from API', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockFeed));

    render(<OperationsFeed />);

    expect(await screen.findByText('Awaiting approval: Deploy to prod')).toBeInTheDocument();
    expect(await screen.findByText('Session stalled: agent-1')).toBeInTheDocument();
  });

  it('shows severity counts', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockFeed));

    render(<OperationsFeed />);

    expect(await screen.findByText('1')).toBeInTheDocument(); // critical count
  });

  it('renders approval buttons for approval items', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockFeed));

    render(<OperationsFeed />);

    expect(await screen.findByText('Approve')).toBeInTheDocument();
    expect(await screen.findByText('Deny')).toBeInTheDocument();
  });

  it('shows empty state when no items', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ items: [], counts: { critical: 0, high: 0, medium: 0, low: 0, total: 0 } }));

    render(<OperationsFeed />);

    expect(await screen.findByText(/all clear/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/operations-feed-ui.test.jsx`
Expected: FAIL because component does not exist

- [ ] **Step 3: Implement the OperationsFeed container**

Create `app/mission-control/components/OperationsFeed.jsx`:

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck } from 'lucide-react';
import OperationsFeedItem from './OperationsFeedItem.jsx';

const CATEGORIES = [
  { key: null, label: 'All' },
  { key: 'approval', label: 'Approvals' },
  { key: 'failure', label: 'Failures' },
  { key: 'signal', label: 'Signals' },
  { key: 'health', label: 'Health' },
  { key: 'stale', label: 'Stale' },
];

const SEVERITY_BADGE = {
  critical: { color: 'bg-red-500', label: 'Critical' },
  high: { color: 'bg-orange-500', label: 'High' },
  medium: { color: 'bg-amber-500', label: 'Medium' },
  low: { color: 'bg-blue-500', label: 'Low' },
};

export default function OperationsFeed({ agentId, onRefreshRequest }) {
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);

  const fetchFeed = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      params.set('limit', '50');
      const res = await fetch(`/api/operations/feed?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setCounts(data.counts || { critical: 0, high: 0, medium: 0, low: 0, total: 0 });
      }
    } catch {
      // Silently fail — feed is supplementary
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const handleApprove = async (actionId) => {
    try {
      const res = await fetch(`/api/approvals/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'allow' }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.source_id !== actionId));
        setCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        if (onRefreshRequest) onRefreshRequest();
      }
    } catch { /* ignore */ }
  };

  const handleDeny = async (actionId) => {
    try {
      const res = await fetch(`/api/approvals/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'deny' }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.source_id !== actionId));
        setCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        if (onRefreshRequest) onRefreshRequest();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-xl border border-border bg-surface-secondary">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Operations Feed</h3>
        <div className="flex items-center gap-2">
          {Object.entries(SEVERITY_BADGE).map(([sev, cfg]) => (
            counts[sev] > 0 && (
              <span key={sev} className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
                <span className="text-[10px] font-medium text-zinc-400">{counts[sev]}</span>
              </span>
            )
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 border-b border-border px-4 py-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key || 'all'}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-brand/10 text-brand border border-brand/20'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Feed items */}
      <div className="max-h-[560px] overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-pulse text-sm text-zinc-500">Loading operations feed...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500/40" />
            <p className="text-sm text-zinc-400">All clear — no items need attention.</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(255,255,255,0.04)] p-2">
            {items.map((item) => (
              <OperationsFeedItem
                key={item.id}
                item={item}
                onApprove={item.category === 'approval' ? handleApprove : undefined}
                onDeny={item.category === 'approval' ? handleDeny : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/operations-feed-ui.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/mission-control/components/OperationsFeed.jsx __tests__/unit/operations-feed-ui.test.jsx
git commit -m "feat: add operations feed container component"
```

---

## Chunk 4: Mission Control Integration

### Task 6: Replace Mission Control activity split with OperationsFeed

**Files:**
- Modify: `app/mission-control/page.js`

- [ ] **Step 1: Replace BAND 3 in Mission Control**

In `app/mission-control/page.js`:

1. Add the import at the top (after existing imports):
```javascript
import OperationsFeed from './components/OperationsFeed.jsx';
```

2. Replace the entire BAND 3 section (lines 547-568):

```jsx
{/* ═══ BAND 3: Activity Split (60/40) ═══ */}
<div className="grid h-[640px] grid-cols-1 gap-4 lg:grid-cols-5">
  {/* Decision Timeline (60%) */}
  <div className="lg:col-span-3">
    <ActivityTimeline ... />
  </div>
  {/* Mission Feed (40%) */}
  <div className="lg:col-span-2">
    <SwarmActivityLog ... />
  </div>
</div>
```

With:

```jsx
{/* ═══ BAND 3: Operations Feed ═══ */}
<OperationsFeed agentId={agentId} onRefreshRequest={fetchAll} />
```

3. Remove the unused imports if they are no longer used elsewhere in the file:
- `ActivityTimeline`
- `SwarmActivityLog`
- `activeCategory` state and `setActiveCategory`
- `showTelemetry` state and `setShowTelemetry`

Only remove state/imports if they are exclusively used by the old BAND 3 section. Check for other references first.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS (possibly warnings about unused imports — fix those)

- [ ] **Step 3: Commit**

```bash
git add app/mission-control/page.js
git commit -m "feat: replace mission control activity split with operations feed"
```

---

## Chunk 5: Verification

### Task 7: Final verification and docs

- [ ] **Step 1: Run all new tests**

Run:
```bash
npx vitest run __tests__/unit/operations-feed.test.js __tests__/unit/operations-feed-ui.test.jsx
```
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Run checks**

Run:
```bash
npm run lint
npm run docs:check
npm run contracts:check
```
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Update PROJECT_DETAILS.md**

Add the new route to the Execution Studio Routes table:

```markdown
| `GET /api/operations/feed` | Unified operations feed aggregating pending approvals, failed actions, risk signals, degraded capabilities, degraded integrations, and stale loops. Supports `category`, `severity`, `limit`, `offset` filters. Sorted by severity then timestamp. |
```

- [ ] **Step 6: Commit**

```bash
git add PROJECT_DETAILS.md
git commit -m "docs: add operations feed route to PROJECT_DETAILS"
```

---

## Notes For Execution

- The operations feed module's mapper functions are pure — test them thoroughly.
- `buildOperationsFeed` does real SQL queries — tests for it mock the data sources, don't mock SQL.
- The Mission Control page is large (~570 lines). Be careful with the BAND 3 replacement — only touch lines 547-568.
- `ActivityTimeline` and `SwarmActivityLog` components are NOT deleted — they may be used elsewhere or restored later.
- The feed's 30s polling interval matches Mission Control's existing polling.
- Inline approve/deny uses the existing `/api/approvals/[actionId]` route — no new backend work needed.
- The capability health subquery in `buildOperationsFeed` is a simplified version. If the full `capability-health.js` computation is needed, import it instead. Start simple and iterate.
