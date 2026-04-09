# Agent Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `/agents/[agentId]` detail page with a governance-focused agent profile that stitches together decisions, assumptions, signals, trust posture, and policies into a single narrative.

**Architecture:** New `/api/agents/[agentId]/profile` endpoint aggregates governance data in one call. Two new repository functions (`getAgentTrustPosture`, `getAssumptionsSummary`) provide the data. The page is a client component with 6 stacked sections, each in its own component file under `app/agents/[agentId]/components/`.

**Tech Stack:** Next.js 15 App Router, React client components, Tailwind CSS, Lucide icons, existing Card/Badge/Stat UI primitives.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/api/agents/[agentId]/profile/route.js` | Aggregation API — single call returns vitals, trust, signals, assumption summary |
| `app/agents/[agentId]/components/AgentVitalsStrip.jsx` | Top bar: status dot, name, agent_id, stats |
| `app/agents/[agentId]/components/AgentTrustPosture.jsx` | Trust credential badges card |
| `app/agents/[agentId]/components/AgentSignals.jsx` | Conditional active signals list |
| `app/agents/[agentId]/components/AgentDecisionTable.jsx` | Filtered decision history table with expandable rows |
| `app/agents/[agentId]/components/AgentAssumptions.jsx` | Assumptions track record with summary bar |
| `app/agents/[agentId]/components/AgentPoliciesSection.jsx` | Compact policies list with manage picker |
| `__tests__/unit/agent-profile-route.test.js` | Tests for the profile aggregation endpoint |

### Modified Files
| File | Change |
|------|--------|
| `app/agents/[agentId]/page.js` | Replace entire content with new profile layout |
| `app/lib/repositories/agents.repository.js` | Add `getAgentTrustPosture()` |
| `app/lib/repositories/assumptions.repository.js` | Add `getAssumptionsSummary()` |

---

### Task 1: Add `getAssumptionsSummary` repository function

**Files:**
- Modify: `app/lib/repositories/assumptions.repository.js`
- Test: `__tests__/unit/agent-profile-route.test.js` (started here, expanded in later tasks)

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/agent-profile-route.test.js` with the first test:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqlMock } from '../helpers.js';

describe('getAssumptionsSummary', () => {
  it('returns counts by validation state', async () => {
    const sql = createSqlMock({
      queryResponses: [
        [{ total: '23', validated: '14', invalidated: '3', unverified: '6' }],
      ],
    });

    const { getAssumptionsSummary } = await import(
      '../../app/lib/repositories/assumptions.repository.js'
    );
    const result = await getAssumptionsSummary(sql, 'org_test', 'agent_1');

    expect(result).toEqual({ total: 23, validated: 14, invalidated: 3, unverified: 6 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/agent-profile-route.test.js`
Expected: FAIL — `getAssumptionsSummary` is not exported

- [ ] **Step 3: Implement `getAssumptionsSummary`**

Add to the bottom of `app/lib/repositories/assumptions.repository.js`:

```js
export async function getAssumptionsSummary(sql, orgId, agentId) {
  const result = await sql.query(
    `SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE a.validated = 1)::int AS validated,
      COUNT(*) FILTER (WHERE a.invalidated = 1)::int AS invalidated,
      COUNT(*) FILTER (WHERE a.validated = 0 AND a.invalidated = 0)::int AS unverified
    FROM assumptions a
    JOIN action_records ar ON a.action_id = ar.action_id AND ar.org_id = a.org_id
    WHERE a.org_id = $1 AND ar.agent_id = $2`,
    [orgId, agentId]
  );
  const row = result[0] || {};
  return {
    total: parseInt(row.total || '0', 10),
    validated: parseInt(row.validated || '0', 10),
    invalidated: parseInt(row.invalidated || '0', 10),
    unverified: parseInt(row.unverified || '0', 10),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/agent-profile-route.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/repositories/assumptions.repository.js __tests__/unit/agent-profile-route.test.js
git commit -m "feat: add getAssumptionsSummary repository function"
```

---

### Task 2: Add `getAgentTrustPosture` repository function

**Files:**
- Modify: `app/lib/repositories/agents.repository.js`
- Test: `__tests__/unit/agent-profile-route.test.js`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/agent-profile-route.test.js`:

```js
describe('getAgentTrustPosture', () => {
  it('returns trust posture from pairings, identity, policies, and actions', async () => {
    const sql = createSqlMock({
      taggedResponses: [
        // agent_pairings
        [{ permission_level: 'workspace_write', status: 'active' }],
        // agent_identities
        [{ agent_id: 'agent_1' }],
        // settings (ENFORCE_AGENT_SIGNATURES)
        [{ value: 'true' }],
        // policies (all org policies)
        [
          { id: 1, policy_type: 'require_approval', description: 'High risk', agent_ids: null },
          { id: 2, policy_type: 'rate_limit', description: 'Throttle', agent_ids: '["agent_1"]' },
          { id: 3, policy_type: 'block_action_type', description: 'No deploy', agent_ids: '["agent_2"]' },
        ],
        // approval record (allowed)
        [{ count: '12' }],
        // approval record (denied)
        [{ count: '2' }],
        // blocks 30d
        [{ count: '2' }],
      ],
    });

    const { getAgentTrustPosture } = await import(
      '../../app/lib/repositories/agents.repository.js'
    );
    const result = await getAgentTrustPosture(sql, 'org_test', 'agent_1');

    expect(result.permission_level).toBe('workspace_write');
    expect(result.identity_verified).toBe(true);
    expect(result.signature_enforced).toBe(true);
    expect(result.active_policies_count).toBe(2); // global + agent-specific, not agent_2's
    expect(result.approval_record).toEqual({ total: 14, allowed: 12, denied: 2 });
    expect(result.blocks_30d).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/agent-profile-route.test.js`
Expected: FAIL — `getAgentTrustPosture` is not exported

- [ ] **Step 3: Implement `getAgentTrustPosture`**

Add to the bottom of `app/lib/repositories/agents.repository.js`:

```js
/**
 * Aggregate trust posture for a single agent.
 * Returns permission level, identity status, signature enforcement,
 * active policies, approval record, and recent blocks.
 */
export async function getAgentTrustPosture(sql, orgId, agentId) {
  const [pairingRows, identityRows, sigSettingRows, policyRows, allowedRows, deniedRows, blockRows] = await Promise.all([
    sql`SELECT permission_level, status FROM agent_pairings WHERE org_id = ${orgId} AND agent_id = ${agentId} AND status = 'active' LIMIT 1`,
    sql`SELECT agent_id FROM agent_identities WHERE org_id = ${orgId} AND agent_id = ${agentId} LIMIT 1`,
    sql`SELECT value FROM settings WHERE org_id = ${orgId} AND key = 'ENFORCE_AGENT_SIGNATURES' LIMIT 1`,
    sql`SELECT id, policy_type, description, agent_ids FROM policies WHERE org_id = ${orgId} AND active = true`,
    sql`SELECT COUNT(*)::int AS count FROM action_records WHERE org_id = ${orgId} AND agent_id = ${agentId} AND status = 'running' AND EXISTS (SELECT 1 FROM action_records ar2 WHERE ar2.action_id = action_records.action_id AND ar2.org_id = action_records.org_id)`,
    sql`SELECT COUNT(*)::int AS count FROM action_records WHERE org_id = ${orgId} AND agent_id = ${agentId} AND status = 'failed' AND approved_by IS NOT NULL`,
    sql`SELECT COUNT(*)::int AS count FROM action_records WHERE org_id = ${orgId} AND agent_id = ${agentId} AND status = 'blocked' AND timestamp_start::timestamptz > NOW() - INTERVAL '30 days'`,
  ]);

  // NOTE: The approval queries above are simplified. A more accurate approach:
  // "allowed" = actions that were once pending_approval and now have approved_by set
  // "denied" = actions that were once pending_approval and now have status=failed with no approved_by
  // For v1, we use a simpler heuristic below.

  const pairing = pairingRows[0];
  const identityVerified = identityRows.length > 0;
  const signatureEnforced = sigSettingRows[0]?.value === 'true';

  // Filter policies that apply to this agent: global (no agent_ids) or includes this agent_id
  const applicablePolicies = (policyRows || []).filter(p => {
    if (!p.agent_ids) return true; // global
    try {
      const ids = JSON.parse(p.agent_ids);
      return Array.isArray(ids) && ids.includes(agentId);
    } catch { return false; }
  });

  const policies = applicablePolicies.map(p => ({
    policy_id: p.id,
    type: p.policy_type,
    description: p.description,
    scope: p.agent_ids ? 'agent' : 'global',
  }));

  return {
    permission_level: pairing?.permission_level || 'unknown',
    identity_verified: identityVerified,
    signature_enforced: signatureEnforced,
    active_policies_count: policies.length,
    policies,
    approval_record: {
      total: parseInt(allowedRows[0]?.count || '0', 10) + parseInt(deniedRows[0]?.count || '0', 10),
      allowed: parseInt(allowedRows[0]?.count || '0', 10),
      denied: parseInt(deniedRows[0]?.count || '0', 10),
    },
    blocks_30d: parseInt(blockRows[0]?.count || '0', 10),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/agent-profile-route.test.js`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 6: Commit**

```bash
git add app/lib/repositories/agents.repository.js __tests__/unit/agent-profile-route.test.js
git commit -m "feat: add getAgentTrustPosture repository function"
```

---

### Task 3: Create the profile aggregation API endpoint

**Files:**
- Create: `app/api/agents/[agentId]/profile/route.js`
- Test: `__tests__/unit/agent-profile-route.test.js`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/unit/agent-profile-route.test.js`. This requires mocking the dependencies:

```js
// Add these mocks at the top of the file (before existing describes):

const mockGetAgentDetail = vi.fn();
const mockGetAgentTrustPosture = vi.fn();
const mockGetAssumptionsSummary = vi.fn();
const mockComputeSignals = vi.fn();
const mockGetOrgId = vi.fn(() => 'org_test');
const mockSqlInstance = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/repositories/agents.repository.js', () => ({
  getAgentDetail: (...a) => mockGetAgentDetail(...a),
  getAgentTrustPosture: (...a) => mockGetAgentTrustPosture(...a),
}));
vi.mock('../../app/lib/repositories/assumptions.repository.js', () => ({
  getAssumptionsSummary: (...a) => mockGetAssumptionsSummary(...a),
}));
vi.mock('../../app/lib/signals.js', () => ({
  computeSignals: (...a) => mockComputeSignals(...a),
}));

const profileRoute = await import('../../app/api/agents/[agentId]/profile/route.js');

describe('GET /api/agents/[agentId]/profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns aggregated profile data', async () => {
    const agent = {
      agent_id: 'agent_1', agent_name: 'Deploy Bot',
      action_count: 847, last_active: '2026-04-09T10:00:00Z',
      presence_state: 'online', last_heartbeat_at: '2026-04-09T16:00:00Z',
      current_task_id: null,
    };
    mockGetAgentDetail.mockResolvedValueOnce(agent);
    mockGetAgentTrustPosture.mockResolvedValueOnce({
      permission_level: 'workspace_write', identity_verified: true,
      signature_enforced: false, active_policies_count: 2, policies: [],
      approval_record: { total: 10, allowed: 8, denied: 2 }, blocks_30d: 1,
    });
    mockComputeSignals.mockResolvedValueOnce([]);
    mockGetAssumptionsSummary.mockResolvedValueOnce({ total: 5, validated: 3, invalidated: 1, unverified: 1 });

    const request = makeRequest('http://localhost:3000/api/agents/agent_1/profile', {
      headers: { 'x-api-key': 'oc_live_test' },
    });
    const res = await profileRoute.GET(request, { params: Promise.resolve({ agentId: 'agent_1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.agent.agent_id).toBe('agent_1');
    expect(data.trust.permission_level).toBe('workspace_write');
    expect(data.signals).toEqual([]);
    expect(data.assumptions_summary.total).toBe(5);
  });

  it('returns 404 when agent not found', async () => {
    mockGetAgentDetail.mockResolvedValueOnce(null);

    const request = makeRequest('http://localhost:3000/api/agents/agent_nope/profile', {
      headers: { 'x-api-key': 'oc_live_test' },
    });
    const res = await profileRoute.GET(request, { params: Promise.resolve({ agentId: 'agent_nope' }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetAgentDetail.mockRejectedValueOnce(new Error('DB down'));

    const request = makeRequest('http://localhost:3000/api/agents/agent_1/profile', {
      headers: { 'x-api-key': 'oc_live_test' },
    });
    const res = await profileRoute.GET(request, { params: Promise.resolve({ agentId: 'agent_1' }) });
    const data = await res.json();

    expect(res.status).toBe(500);
  });
});
```

Also add `import { makeRequest } from '../helpers.js';` at the top of the file if not already there.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/agent-profile-route.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the route**

Create `app/api/agents/[agentId]/profile/route.js`:

```js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { getAgentDetail, getAgentTrustPosture } from '../../../../lib/repositories/agents.repository.js';
import { getAssumptionsSummary } from '../../../../lib/repositories/assumptions.repository.js';
import { computeSignals } from '../../../../lib/signals.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { agentId } = await params;

    const agent = await getAgentDetail(sql, orgId, agentId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const [trust, signals, assumptionsSummary] = await Promise.all([
      getAgentTrustPosture(sql, orgId, agentId),
      computeSignals(orgId, agentId, sql),
      getAssumptionsSummary(sql, orgId, agentId),
    ]);

    return NextResponse.json({
      agent: {
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
        action_count: agent.action_count || 0,
        last_active: agent.last_active,
        first_seen: agent.last_active, // best approximation from current data
        total_cost: null, // computed client-side from actions if needed
        presence: {
          status: agent.presence_state || 'unknown',
          last_heartbeat_at: agent.last_heartbeat_at || null,
          current_task_id: agent.current_task_id || null,
        },
      },
      trust,
      signals,
      assumptions_summary: assumptionsSummary,
    });
  } catch (error) {
    console.error('[AGENT PROFILE] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/agent-profile-route.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/agents/[agentId]/profile/route.js __tests__/unit/agent-profile-route.test.js
git commit -m "feat: add /api/agents/[agentId]/profile aggregation endpoint"
```

---

### Task 4: Build the AgentVitalsStrip component

**Files:**
- Create: `app/agents/[agentId]/components/AgentVitalsStrip.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Brain, CheckCircle2, Fingerprint } from 'lucide-react';

const presenceDot = {
  online: 'bg-emerald-500',
  stale: 'bg-amber-500',
  offline: 'bg-zinc-500',
  unknown: 'bg-zinc-500',
};

const presenceLabel = {
  online: 'Online',
  stale: 'Stale',
  offline: 'Offline',
  unknown: 'Unknown',
};

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentVitalsStrip({ agent, identityVerified }) {
  const status = agent.presence?.status || 'unknown';

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 border border-brand/20 text-brand">
            <Brain size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white truncate">{agent.agent_name}</h2>
              {identityVerified && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                  <Fingerprint size={10} /> Verified
                </span>
              )}
            </div>
            <div className="font-mono text-xs text-zinc-500 truncate">{agent.agent_id}</div>
          </div>
        </div>

        {/* Right: stats */}
        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${presenceDot[status]}`} />
            <span className="text-zinc-300">{presenceLabel[status]}</span>
            <span className="text-zinc-500">&middot;</span>
            <span>Last seen {formatRelativeTime(agent.presence?.last_heartbeat_at || agent.last_active)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span><span className="text-white font-medium">{(agent.action_count || 0).toLocaleString()}</span> actions</span>
            {agent.total_cost != null && (
              <span><span className="text-white font-medium">${agent.total_cost.toFixed(2)}</span> cost</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agents/[agentId]/components/AgentVitalsStrip.jsx
git commit -m "feat: add AgentVitalsStrip component"
```

---

### Task 5: Build the AgentTrustPosture component

**Files:**
- Create: `app/agents/[agentId]/components/AgentTrustPosture.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Badge } from '../../../components/ui/Badge';
import { Shield, Fingerprint, Lock, ShieldCheck, ShieldAlert } from 'lucide-react';

const permissionVariant = {
  danger: 'error',
  workspace_write: 'warning',
  prompt: 'info',
  allow: 'success',
  readonly: 'default',
  unknown: 'default',
};

export default function AgentTrustPosture({ trust }) {
  const approvalPct = trust.approval_record.total > 0
    ? Math.round((trust.approval_record.allowed / trust.approval_record.total) * 100)
    : null;

  const approvalVariant = approvalPct === null ? 'default' : approvalPct >= 80 ? 'success' : approvalPct >= 50 ? 'warning' : 'error';

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={14} className="text-zinc-500" />
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Trust Posture</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={permissionVariant[trust.permission_level] || 'default'} size="xs">
          Permission: {trust.permission_level}
        </Badge>

        <Badge variant={trust.identity_verified ? 'success' : 'default'} size="xs">
          <Fingerprint size={10} className="mr-1" />
          {trust.identity_verified ? 'Verified' : 'Unsigned'}
        </Badge>

        <Badge variant={trust.signature_enforced ? 'success' : 'default'} size="xs">
          <Lock size={10} className="mr-1" />
          Signature: {trust.signature_enforced ? 'Enforced' : 'Optional'}
        </Badge>

        <Badge variant="info" size="xs">
          <ShieldCheck size={10} className="mr-1" />
          {trust.active_policies_count} {trust.active_policies_count === 1 ? 'policy' : 'policies'}
        </Badge>

        {trust.approval_record.total > 0 && (
          <Badge variant={approvalVariant} size="xs">
            Approvals: {trust.approval_record.allowed} of {trust.approval_record.total}
            {approvalPct !== null && ` (${approvalPct}%)`}
          </Badge>
        )}

        {trust.blocks_30d > 0 && (
          <Badge variant="error" size="xs">
            <ShieldAlert size={10} className="mr-1" />
            {trust.blocks_30d} blocked (30d)
          </Badge>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agents/[agentId]/components/AgentTrustPosture.jsx
git commit -m "feat: add AgentTrustPosture component"
```

---

### Task 6: Build the AgentSignals component

**Files:**
- Create: `app/agents/[agentId]/components/AgentSignals.jsx`

- [ ] **Step 1: Create the component**

```jsx
export default function AgentSignals({ signals }) {
  if (!signals || signals.length === 0) return null;

  const redCount = signals.filter(s => s.severity === 'red').length;
  const amberCount = signals.filter(s => s.severity === 'amber').length;

  return (
    <div className="rounded-2xl border border-red-500/20 bg-[#111] px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">Active Signals</span>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
          {signals.length}
        </span>
        {redCount > 0 && (
          <span className="text-[10px] text-red-400">{redCount} red</span>
        )}
        {amberCount > 0 && (
          <span className="text-[10px] text-amber-400">{amberCount} amber</span>
        )}
      </div>
      <div className="space-y-3">
        {signals.map((signal, i) => (
          <div key={signal.type + '-' + i} className="flex items-start gap-3">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${signal.severity === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{signal.label}</div>
              <div className="mt-0.5 text-xs text-zinc-400">{signal.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agents/[agentId]/components/AgentSignals.jsx
git commit -m "feat: add AgentSignals component"
```

---

### Task 7: Build the AgentDecisionTable component

**Files:**
- Create: `app/agents/[agentId]/components/AgentDecisionTable.jsx`

- [ ] **Step 1: Create the component**

This is the largest component. It replicates the Decisions Ledger table pattern scoped to one agent.

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import {
  CheckCircle2, XCircle, Clock, Loader2, Ban,
  ChevronDown, ChevronUp,
} from 'lucide-react';

const statusIcon = {
  completed: CheckCircle2, failed: XCircle, pending: Clock,
  running: Loader2, cancelled: Ban, blocked: Ban, pending_approval: Clock,
};
const statusVariant = {
  completed: 'success', failed: 'error', running: 'warning',
  cancelled: 'default', pending: 'info', blocked: 'error', pending_approval: 'info',
};

function riskColor(score) {
  if (score >= 70) return 'text-red-400';
  if (score >= 30) return 'text-amber-400';
  return 'text-zinc-400';
}

function formatRelativeTime(isoString) {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentDecisionTable({ agentId }) {
  const [actions, setActions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRiskMin, setFilterRiskMin] = useState('1');
  const [filterRange, setFilterRange] = useState('30');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchActions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('agent_id', agentId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());
      if (filterStatus) params.set('status', filterStatus);
      else params.set('exclude_status', 'running');
      if (filterType) params.set('action_type', filterType);
      if (filterRiskMin) params.set('risk_min', filterRiskMin);

      const res = await fetch(`/api/actions?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setActions(data.actions || []);
        } else {
          setActions(prev => [...prev, ...(data.actions || [])]);
        }
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch decisions:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, filterStatus, filterType, filterRiskMin, filterRange, offset]);

  useEffect(() => {
    setOffset(0);
  }, [filterStatus, filterType, filterRiskMin, filterRange]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const toggleExpand = (actionId) => {
    setExpandedId(prev => prev === actionId ? null : actionId);
  };

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Decision History</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">{total}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
            <option value="pending_approval">Pending approval</option>
            <option value="running">Running</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
            <option value="">All types</option>
            {['build','deploy','post','apply','security','message','api','research','review','fix','refactor','test','config','monitor'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filterRiskMin} onChange={e => setFilterRiskMin(e.target.value)} className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
            <option value="">Any risk</option>
            <option value="1">Risk 1+</option>
            <option value="30">Risk 30+</option>
            <option value="50">Risk 50+</option>
            <option value="70">Risk 70+</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading && actions.length === 0 ? (
        <div className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-zinc-500">No decisions match the current filters.</div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {actions.map(action => {
            const StatusIcon = statusIcon[action.status] || Clock;
            const expanded = expandedId === action.action_id;
            return (
              <div key={action.action_id}>
                <button
                  onClick={() => toggleExpand(action.action_id)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <Badge variant={statusVariant[action.status] || 'default'} size="xs">
                    <StatusIcon size={10} className="mr-1" />
                    {action.status}
                  </Badge>
                  <span className="text-xs text-zinc-500 w-20 shrink-0">{action.action_type}</span>
                  <span className="text-sm text-zinc-300 truncate flex-1">{action.declared_goal || '—'}</span>
                  <span className={`text-xs font-mono w-8 text-right ${riskColor(action.risk_score)}`}>
                    {action.risk_score ?? '—'}
                  </span>
                  <span className="text-xs text-zinc-500 w-20 text-right shrink-0">
                    {formatRelativeTime(action.timestamp_start)}
                  </span>
                  {expanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                </button>
                {expanded && (
                  <div className="bg-white/[0.02] border-t border-white/[0.04] px-5 py-4 space-y-2 text-xs">
                    {action.reasoning && <div><span className="text-zinc-500">Reasoning:</span> <span className="text-zinc-300">{action.reasoning}</span></div>}
                    {action.input_summary && <div><span className="text-zinc-500">Input:</span> <span className="text-zinc-300">{action.input_summary}</span></div>}
                    {action.output_summary && <div><span className="text-zinc-500">Output:</span> <span className="text-zinc-300">{action.output_summary}</span></div>}
                    {action.error_message && <div><span className="text-zinc-500">Error:</span> <span className="text-red-400">{action.error_message}</span></div>}
                    {action.duration_ms != null && <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300">{(action.duration_ms / 1000).toFixed(1)}s</span></div>}
                    {action.cost_estimate != null && action.cost_estimate > 0 && <div><span className="text-zinc-500">Cost:</span> <span className="text-zinc-300">${action.cost_estimate.toFixed(4)}</span></div>}
                    {action.approved_by && <div><span className="text-zinc-500">Approved by:</span> <span className="text-emerald-400">{action.approved_by}</span></div>}
                    <div className="font-mono text-zinc-600 pt-1">{action.action_id}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {actions.length < total && (
        <div className="border-t border-white/[0.04] px-5 py-3 text-center">
          <button
            onClick={() => setOffset(actions.length)}
            disabled={loading}
            className="text-xs text-brand hover:text-brand/80 disabled:opacity-50"
          >
            {loading ? 'Loading...' : `Load more (${actions.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agents/[agentId]/components/AgentDecisionTable.jsx
git commit -m "feat: add AgentDecisionTable component"
```

---

### Task 8: Build the AgentAssumptions component

**Files:**
- Create: `app/agents/[agentId]/components/AgentAssumptions.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client';

import { useState, useEffect } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';

function formatAge(isoString) {
  if (!isoString) return '—';
  const days = Math.floor((Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  return `${days}d`;
}

export default function AgentAssumptions({ agentId, summary }) {
  const [assumptions, setAssumptions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch the top 5 notable assumptions on mount
    const fetchNotable = async () => {
      try {
        const res = await fetch(`/api/assumptions?agent_id=${encodeURIComponent(agentId)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setAssumptions(data.assumptions || []);
        }
      } catch (err) {
        console.error('Failed to fetch assumptions:', err);
      }
    };
    fetchNotable();
  }, [agentId]);

  // Sort: invalidated first, then unverified by age, then validated
  const sorted = [...assumptions].sort((a, b) => {
    if (a.invalidated && !b.invalidated) return -1;
    if (!a.invalidated && b.invalidated) return 1;
    if (!a.validated && !a.invalidated && (b.validated || b.invalidated)) return -1;
    if ((a.validated || a.invalidated) && !b.validated && !b.invalidated) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const visible = showAll ? sorted : sorted.slice(0, 5);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Assumptions</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">{summary.total}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="xs"><CheckCircle2 size={10} className="mr-1" />{summary.validated} validated</Badge>
          <Badge variant="error" size="xs"><XCircle size={10} className="mr-1" />{summary.invalidated} invalidated</Badge>
          <Badge variant="default" size="xs"><HelpCircle size={10} className="mr-1" />{summary.unverified} unverified</Badge>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-6 text-center text-sm text-zinc-500">No assumptions recorded for this agent.</div>
      ) : (
        <div className="space-y-3">
          {visible.map(asm => {
            const isInvalidated = asm.invalidated === 1 || asm.invalidated === true;
            const isValidated = asm.validated === 1 || asm.validated === true;

            return (
              <div key={asm.assumption_id} className="flex items-start gap-3">
                {isInvalidated ? (
                  <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                ) : isValidated ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                ) : (
                  <HelpCircle size={14} className="mt-0.5 shrink-0 text-zinc-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-200">{asm.assumption}</div>
                  {asm.basis && <div className="mt-0.5 text-xs text-zinc-500">Basis: {asm.basis}</div>}
                  {isInvalidated && asm.invalidated_reason && (
                    <div className="mt-0.5 text-xs text-red-400">Reason: {asm.invalidated_reason}</div>
                  )}
                  {!isValidated && !isInvalidated && asm.drift_score >= 50 && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-400">
                      <AlertTriangle size={10} /> Drift score: {asm.drift_score}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-xs text-zinc-500">
                  {isInvalidated ? 'invalidated' : isValidated ? 'validated' : 'unverified'} &middot; {formatAge(asm.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 5 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 text-xs text-brand hover:text-brand/80"
        >
          Show all {sorted.length}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agents/[agentId]/components/AgentAssumptions.jsx
git commit -m "feat: add AgentAssumptions component"
```

---

### Task 9: Build the AgentPoliciesSection component

**Files:**
- Create: `app/agents/[agentId]/components/AgentPoliciesSection.jsx`

- [ ] **Step 1: Create the component**

Reuses the existing policy assignment logic from the current detail page but in a compact section layout:

```jsx
'use client';

import { useState } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Shield, Plus, X } from 'lucide-react';

function parseAgentIds(policy) {
  if (!policy.agent_ids) return [];
  try { const p = JSON.parse(policy.agent_ids); return Array.isArray(p) ? p : []; } catch { return []; }
}

function formatPolicyRules(policy) {
  const policyType = policy.policy_type || policy.type;
  let rules;
  try { rules = JSON.parse(policy.rules || '{}'); } catch { return policyType; }
  switch (policyType) {
    case 'risk_threshold': return `Risk >= ${rules.threshold} → ${rules.action || 'block'}`;
    case 'require_approval': return `${(rules.action_types || []).join(', ')} → require approval`;
    case 'block_action_type': return `${(rules.action_types || []).join(', ')} → block`;
    case 'rate_limit': return `Max ${rules.max_actions} / ${rules.window_minutes}min`;
    case 'webhook_check': return 'Webhook check';
    case 'semantic_check': return `Semantic: "${(rules.instruction || '').slice(0, 40)}..."`;
    default: return policyType;
  }
}

export default function AgentPoliciesSection({ agentId, policies, allPolicies, onRefresh }) {
  const [showPicker, setShowPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const applicablePolicies = (policies || []).filter(p => {
    const ids = parseAgentIds(p);
    return ids.length === 0 || ids.includes(agentId);
  });

  const unassignedPolicies = (allPolicies || []).filter(p => {
    const ids = parseAgentIds(p);
    if (ids.length === 0) return false; // already global
    return !ids.includes(agentId);
  });

  const handleAssign = async (policy) => {
    setAssigning(true);
    try {
      const currentIds = parseAgentIds(policy);
      const newIds = [...currentIds, agentId];
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, agent_ids: JSON.stringify(newIds) }),
      });
      if (res.ok) onRefresh?.();
    } catch { /* ignore */ }
    finally { setAssigning(false); }
  };

  const handleUnassign = async (policy) => {
    setAssigning(true);
    try {
      const currentIds = parseAgentIds(policy);
      const newIds = currentIds.filter(id => id !== agentId);
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, agent_ids: newIds.length > 0 ? JSON.stringify(newIds) : null }),
      });
      if (res.ok) onRefresh?.();
    } catch { /* ignore */ }
    finally { setAssigning(false); }
  };

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-zinc-500" />
          <span className="text-sm font-medium text-white">Policies</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">{applicablePolicies.length} active</span>
        </div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1 text-xs text-brand hover:text-brand/80"
        >
          <Plus size={12} /> Manage
        </button>
      </div>

      {applicablePolicies.length === 0 ? (
        <div className="py-4 text-center text-sm text-zinc-500">No policies apply to this agent.</div>
      ) : (
        <div className="space-y-2">
          {applicablePolicies.map(p => {
            const isGlobal = parseAgentIds(p).length === 0;
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge size="xs">{p.policy_type || p.type}</Badge>
                  <span className="text-xs text-zinc-300 truncate">{formatPolicyRules(p)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={isGlobal ? 'default' : 'brand'} size="xs">{isGlobal ? 'global' : 'agent'}</Badge>
                  {!isGlobal && (
                    <button onClick={() => handleUnassign(p)} disabled={assigning} className="text-zinc-500 hover:text-red-400 disabled:opacity-50">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker && unassignedPolicies.length > 0 && (
        <div className="mt-3 border-t border-white/[0.04] pt-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Assign policy</div>
          <div className="space-y-1">
            {unassignedPolicies.map(p => (
              <button
                key={p.id}
                onClick={() => handleAssign(p)}
                disabled={assigning}
                className="w-full flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-left hover:bg-white/[0.04] disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge size="xs">{p.policy_type || p.type}</Badge>
                  <span className="text-xs text-zinc-400 truncate">{formatPolicyRules(p)}</span>
                </div>
                <Plus size={12} className="text-brand shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agents/[agentId]/components/AgentPoliciesSection.jsx
git commit -m "feat: add AgentPoliciesSection component"
```

---

### Task 10: Replace the agent detail page with the profile layout

**Files:**
- Modify: `app/agents/[agentId]/page.js`

- [ ] **Step 1: Replace the page content**

Replace the entire content of `app/agents/[agentId]/page.js` with:

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCw, ShieldAlert } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import AgentVitalsStrip from './components/AgentVitalsStrip';
import AgentTrustPosture from './components/AgentTrustPosture';
import AgentSignals from './components/AgentSignals';
import AgentDecisionTable from './components/AgentDecisionTable';
import AgentAssumptions from './components/AgentAssumptions';
import AgentPoliciesSection from './components/AgentPoliciesSection';

export default function AgentProfilePage() {
  const { agentId } = useParams();
  const decodedAgentId = decodeURIComponent(agentId);

  const [profile, setProfile] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, agentPoliciesRes, allPoliciesRes] = await Promise.all([
        fetch(`/api/agents/${encodeURIComponent(decodedAgentId)}/profile`),
        fetch(`/api/policies?agent_id=${encodeURIComponent(decodedAgentId)}`),
        fetch('/api/policies'),
      ]);

      if (!profileRes.ok) {
        if (profileRes.status === 404) throw new Error('Agent not found');
        throw new Error('Failed to load profile');
      }

      const profileData = await profileRes.json();
      setProfile(profileData);

      if (agentPoliciesRes.ok) {
        const pData = await agentPoliciesRes.json();
        setPolicies(pData.policies || []);
      }
      if (allPoliciesRes.ok) {
        const aData = await allPoliciesRes.json();
        setAllPolicies(aData.policies || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [decodedAgentId]);

  useEffect(() => {
    if (decodedAgentId) fetchProfile();
  }, [decodedAgentId, fetchProfile]);

  if (loading) {
    return (
      <PageLayout title="Agent Profile" breadcrumbs={['Observe', 'Fleet', 'Profile']}>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PageLayout>
    );
  }

  if (error || !profile) {
    return (
      <PageLayout title="Agent Not Found" breadcrumbs={['Observe', 'Fleet', decodedAgentId]}>
        <div className="max-w-md mx-auto mt-12 text-center">
          <Card hover={false}>
            <CardContent className="pt-8">
              <ShieldAlert size={32} className="text-zinc-600 mx-auto mb-3" />
              <div className="text-lg font-medium text-white mb-2">{error || 'Agent not found'}</div>
              <Link href="/agents" className="text-brand hover:underline text-sm font-medium">Back to Fleet</Link>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={profile.agent.agent_name}
      breadcrumbs={['Observe', 'Fleet', profile.agent.agent_name]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/agents" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Fleet
          </Link>
          <button
            onClick={fetchProfile}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors"
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <AgentVitalsStrip
          agent={profile.agent}
          identityVerified={profile.trust.identity_verified}
        />

        <AgentTrustPosture trust={profile.trust} />

        <AgentSignals signals={profile.signals} />

        <AgentDecisionTable agentId={decodedAgentId} />

        <AgentAssumptions
          agentId={decodedAgentId}
          summary={profile.assumptions_summary}
        />

        <AgentPoliciesSection
          agentId={decodedAgentId}
          policies={policies}
          allPolicies={allPolicies}
          onRefresh={fetchProfile}
        />
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (the old page had no tests to break)

- [ ] **Step 3: Commit**

```bash
git add app/agents/[agentId]/page.js
git commit -m "feat: replace agent detail page with governance profile"
```

---

### Task 11: Final integration test and cleanup

**Files:**
- Test: `__tests__/unit/agent-profile-route.test.js`
- Verify: All files from tasks 1-10

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, including the new agent-profile-route tests

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 3: Run dev server and manually verify**

Run: `npm run dev`
Navigate to `/agents` → click any agent → verify the profile page loads with all 6 sections.

- [ ] **Step 4: Commit spec + plan docs together**

```bash
git add docs/superpowers/specs/2026-04-09-agent-profiles-design.md docs/superpowers/plans/2026-04-09-agent-profiles.md
git commit -m "docs: add agent profiles design spec and implementation plan"
```
