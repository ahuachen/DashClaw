# Policy Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `/policies` page with a shields-first policy experience where common protections are visual toggles, power user tools live in a Custom tab, and guard activity is transparent.

**Architecture:** Pre-built shields are defined client-side in `shields.js` and mapped to real policy records via a `_shield` tag in the rules JSON. A new `GET /api/guard/decisions` endpoint serves the Activity tab. The page is decomposed into focused components per tab. Existing policy CRUD, simulate, generate, import, and template APIs are reused unchanged.

**Tech Stack:** Next.js 15 App Router, React client components, Tailwind CSS, Lucide icons, existing UI primitives (Card, Badge, Skeleton, EmptyState).

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/policies/lib/shields.js` | Shield definitions array (id, name, description, icon, policyType, defaultRules) |
| `app/policies/components/ShieldsGrid.jsx` | Shields tab — fetches policies, maps to shields, renders grid |
| `app/policies/components/ShieldCard.jsx` | Individual shield — toggle, stats, configure expand |
| `app/policies/components/ShieldConfig.jsx` | Type-specific inline config panels |
| `app/policies/components/RiskExplainer.jsx` | Collapsible risk score breakdown |
| `app/policies/components/CustomTab.jsx` | Custom tab — full policy list, actions, forms |
| `app/policies/components/ActivityTab.jsx` | Guard decisions feed with risk breakdowns |
| `app/policies/components/AgentScopePicker.jsx` | Reusable "All agents" / specific agents selector |
| `app/api/guard/decisions/route.js` | Guard decision history endpoint |
| `__tests__/unit/guard-decisions-route.test.js` | Tests for guard decisions endpoint |

### Modified Files
| File | Change |
|------|--------|
| `app/policies/page.jsx` | Full replacement — thin shell with tabs + stats bar |

### Preserved (unchanged)
| File | Why |
|------|-----|
| `app/policies/lib/policyFormModel.js` | Reused by CustomTab for compile/decompile |
| `app/policies/components/PolicyAuthoringPanel.jsx` | Reused by CustomTab for create/edit |
| `app/policies/components/PolicyAdvancedImportPanel.jsx` | Reused by CustomTab for import |
| `app/policies/components/PolicyBasicsSection.jsx` | Reused by PolicyAuthoringPanel |
| `app/policies/components/PolicyRuleBuilderSection.jsx` | Reused by PolicyAuthoringPanel |
| `app/policies/components/PolicySummaryCard.jsx` | Reused by PolicyAuthoringPanel |
| All `/api/policies/*` routes | CRUD, simulate, generate, import, templates — all reused |

---

### Task 1: Create shield definitions

**Files:**
- Create: `app/policies/lib/shields.js`

- [ ] **Step 1: Create the shields definition file**

```js
export const SHIELDS = [
  {
    id: 'deploy_gate',
    name: 'Deploy Gate',
    description: 'Require approval before any deploy or migration',
    icon: 'Rocket',
    policyType: 'require_approval',
    defaultRules: { action_types: ['deploy', 'migrate'] },
  },
  {
    id: 'risk_high',
    name: 'High Risk Review',
    description: 'Require approval for actions with risk score 70+',
    icon: 'AlertTriangle',
    policyType: 'risk_threshold',
    defaultRules: { threshold: 70, action: 'require_approval' },
  },
  {
    id: 'risk_critical',
    name: 'Critical Risk Block',
    description: 'Block actions with risk score 90 or above',
    icon: 'ShieldAlert',
    policyType: 'risk_threshold',
    defaultRules: { threshold: 90, action: 'block' },
  },
  {
    id: 'destructive_block',
    name: 'Destructive Ops Block',
    description: 'Block apply, migrate, and sync operations',
    icon: 'Ban',
    policyType: 'block_action_type',
    defaultRules: { action_types: ['apply', 'migrate', 'sync'] },
  },
  {
    id: 'rate_limiter',
    name: 'Rate Limiter',
    description: 'Warn when an agent exceeds 30 actions per hour',
    icon: 'Timer',
    policyType: 'rate_limit',
    defaultRules: { max_actions: 30, window_minutes: 60, action: 'warn' },
  },
  {
    id: 'api_review',
    name: 'API Call Review',
    description: 'Require approval for all API actions',
    icon: 'Globe',
    policyType: 'require_approval',
    defaultRules: { action_types: ['api'] },
  },
  {
    id: 'secret_guard',
    name: 'Secret Exposure Guard',
    description: 'Block actions that might expose credentials or secrets',
    icon: 'Lock',
    policyType: 'semantic_check',
    defaultRules: { instruction: 'Block actions that might expose API keys, passwords, authentication tokens, or credentials. Also block actions that reference .env files or secret management systems.', fallback: 'block' },
  },
  {
    id: 'outbound_gate',
    name: 'Outbound Message Gate',
    description: 'Require approval before sending messages or posts',
    icon: 'MessageSquare',
    policyType: 'require_approval',
    defaultRules: { action_types: ['message', 'post'] },
  },
];

/**
 * Match existing policies to shield definitions via the _shield tag in rules JSON.
 * Returns a Map of shieldId -> policy (or null if not activated).
 */
export function matchShieldsToPolices(policies) {
  const map = new Map();
  for (const shield of SHIELDS) {
    map.set(shield.id, null);
  }
  for (const policy of policies) {
    try {
      const rules = JSON.parse(policy.rules || '{}');
      if (rules._shield && map.has(rules._shield)) {
        map.set(rules._shield, policy);
      }
    } catch { /* skip malformed */ }
  }
  return map;
}

/**
 * Build the API payload to create a shield policy.
 */
export function buildShieldPayload(shield) {
  return {
    name: shield.name,
    policy_type: shield.policyType,
    rules: JSON.stringify({ ...shield.defaultRules, _shield: shield.id }),
    active: 1,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/lib/shields.js
git commit -m "feat: add shield definitions for policy builder"
```

---

### Task 2: Create the guard decisions API endpoint

**Files:**
- Create: `app/api/guard/decisions/route.js`
- Create: `__tests__/unit/guard-decisions-route.test.js`

- [ ] **Step 1: Write the test file**

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest, createSqlMock } from '../helpers.js';

const mockGetOrgId = vi.fn(() => 'org_test');
let mockSqlInstance;

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));

const { GET } = await import('../../app/api/guard/decisions/route.js');

function getReq(params = '') {
  return makeRequest(`http://localhost:3000/api/guard/decisions${params}`, {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

describe('GET /api/guard/decisions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns decisions with stats', async () => {
    mockSqlInstance = createSqlMock({
      queryResponses: [
        // decisions query
        [
          { id: 'gd_1', decision: 'block', risk_score: 90, agent_id: 'a1', action_type: 'deploy', reason: 'Risk >= 90', matched_policies: '["Critical Risk Block"]', context: '{}', created_at: '2026-04-09T10:00:00Z' },
        ],
        // count query
        [{ total: '1' }],
        // stats query
        [{ blocks: '5', approvals: '3', warns: '2' }],
      ],
    });

    const res = await GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.decisions).toHaveLength(1);
    expect(data.decisions[0].decision).toBe('block');
    expect(data.total).toBe(1);
    expect(data.stats.blocks).toBe(5);
  });

  it('filters by decision type', async () => {
    mockSqlInstance = createSqlMock({
      queryResponses: [[], [{ total: '0' }], [{ blocks: '0', approvals: '0', warns: '0' }]],
    });

    await GET(getReq('?decision=block'));

    const queryText = mockSqlInstance.queryCalls[0].text;
    expect(queryText).toContain('decision =');
  });

  it('returns 500 on error', async () => {
    mockSqlInstance = createSqlMock({ queryResponses: [] });
    mockSqlInstance.query = async () => { throw new Error('DB down'); };

    const res = await GET(getReq());
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/guard-decisions-route.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Create the route**

Create `app/api/guard/decisions/route.js`:

```js
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const decision = searchParams.get('decision') || undefined;
    const agentId = searchParams.get('agent_id') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let paramIdx = 1;
    const conditions = [`gd.org_id = $${paramIdx++}`];
    const params = [orgId];

    if (decision) {
      conditions.push(`gd.decision = $${paramIdx++}`);
      params.push(decision);
    }
    if (agentId) {
      conditions.push(`gd.agent_id = $${paramIdx++}`);
      params.push(agentId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const decisionsQuery = `
      SELECT gd.id, gd.decision, gd.risk_score, gd.agent_id, gd.action_type,
             gd.reason, gd.matched_policies, gd.context, gd.created_at
      FROM guard_decisions gd
      ${where}
      ORDER BY gd.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const countQuery = `SELECT COUNT(*)::int AS total FROM guard_decisions gd ${where}`;
    const countParams = params.slice(0, -2);

    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE decision = 'block')::int AS blocks,
        COUNT(*) FILTER (WHERE decision = 'require_approval')::int AS approvals,
        COUNT(*) FILTER (WHERE decision = 'warn')::int AS warns
      FROM guard_decisions
      WHERE org_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    `;

    const [decisions, countResult, statsResult] = await Promise.all([
      sql.query(decisionsQuery, params),
      sql.query(countQuery, countParams),
      sql.query(statsQuery, [orgId]),
    ]);

    // Parse matched_policies JSON for each decision
    const parsed = (decisions || []).map(d => {
      let matchedPolicies = [];
      try { matchedPolicies = JSON.parse(d.matched_policies || '[]'); } catch { /* skip */ }
      let context = {};
      try { context = JSON.parse(d.context || '{}'); } catch { /* skip */ }
      return {
        ...d,
        matched_policies: matchedPolicies,
        context: undefined, // don't send raw context to client
        declared_goal: context.declared_goal || null,
        agent_name: context.agent_name || null,
      };
    });

    const stats = statsResult[0] || {};

    return NextResponse.json({
      decisions: parsed,
      total: parseInt(countResult[0]?.total || '0', 10),
      stats: {
        blocks: parseInt(stats.blocks || '0', 10),
        approvals: parseInt(stats.approvals || '0', 10),
        warns: parseInt(stats.warns || '0', 10),
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'GUARD DECISIONS GET');
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run __tests__/unit/guard-decisions-route.test.js`
Expected: PASS

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add app/api/guard/decisions/route.js __tests__/unit/guard-decisions-route.test.js
git commit -m "feat: add GET /api/guard/decisions endpoint"
```

---

### Task 3: Build RiskExplainer component

**Files:**
- Create: `app/policies/components/RiskExplainer.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const BASE_SCORES = [
  { type: 'security', score: 80 },
  { type: 'deploy', score: 75 },
  { type: 'migrate', score: 70 },
  { type: 'apply', score: 60 },
  { type: 'sync', score: 40 },
  { type: 'api', score: 35 },
  { type: 'config', score: 30 },
  { type: 'cleanup', score: 30 },
  { type: 'build', score: 25 },
  { type: 'post', score: 25 },
  { type: 'fix', score: 20 },
  { type: 'refactor', score: 20 },
  { type: 'other', score: 20 },
  { type: 'message', score: 15 },
  { type: 'test', score: 15 },
  { type: 'calendar', score: 10 },
  { type: 'research', score: 10 },
  { type: 'review', score: 10 },
  { type: 'monitor', score: 10 },
  { type: 'alert', score: 10 },
];

const MODIFIERS = [
  { label: 'Irreversible action', value: '+15' },
  { label: 'Touches production / database', value: '+10' },
  { label: 'Touches filesystem / shell', value: '+5' },
  { label: 'Destructive goal pattern (rm -rf, drop table, etc.)', value: '+20' },
  { label: 'Deployment goal (push, deploy, release, etc.)', value: '+10' },
  { label: 'References secrets / keys / .env', value: '+15' },
];

export default function RiskExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <Info size={12} />
        How are risk scores calculated?
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] p-4 space-y-4 text-xs">
          <div>
            <div className="text-zinc-500 uppercase tracking-widest text-[10px] mb-2">Base score by action type</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              {BASE_SCORES.map(({ type, score }) => (
                <div key={type} className="flex justify-between">
                  <span className="text-zinc-400">{type}</span>
                  <span className="font-mono text-zinc-300">{score}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase tracking-widest text-[10px] mb-2">Modifiers</div>
            <div className="space-y-1">
              {MODIFIERS.map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-zinc-400">{label}</span>
                  <span className="font-mono text-amber-400">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-3">
            <div className="text-zinc-500 mb-1">Formula</div>
            <div className="font-mono text-zinc-300">score = min(base + modifiers, 100)</div>
            <div className="mt-2 text-zinc-500">
              Example: <span className="text-zinc-300">deploy (75) + irreversible (+15) = <span className="text-red-400 font-medium">90</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/RiskExplainer.jsx
git commit -m "feat: add RiskExplainer component"
```

---

### Task 4: Build AgentScopePicker component

**Files:**
- Create: `app/policies/components/AgentScopePicker.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

export default function AgentScopePicker({ agentIds = [], onChange }) {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch { /* ignore */ }
    };
    fetchAgents();
  }, []);

  const isAllAgents = !agentIds || agentIds.length === 0;

  const toggleAgent = (id) => {
    if (agentIds.includes(id)) {
      onChange(agentIds.filter(a => a !== id));
    } else {
      onChange([...agentIds, id]);
    }
  };

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Applies to</div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange([])}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
            isAllAgents
              ? 'bg-brand/10 border border-brand/40 text-brand'
              : 'bg-white/5 border border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          <Users size={12} /> All agents
        </button>
        {agents.map(agent => {
          const active = agentIds.includes(agent.agent_id);
          return (
            <button
              key={agent.agent_id}
              onClick={() => toggleAgent(agent.agent_id)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                active
                  ? 'bg-brand/10 border border-brand/40 text-brand'
                  : 'bg-white/5 border border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {agent.agent_name || agent.agent_id}
            </button>
          );
        })}
      </div>
      {agents.length === 0 && (
        <div className="mt-2 text-xs text-zinc-500">No agents discovered yet. Policies will apply to all agents.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/AgentScopePicker.jsx
git commit -m "feat: add AgentScopePicker component"
```

---

### Task 5: Build ShieldConfig component

**Files:**
- Create: `app/policies/components/ShieldConfig.jsx`

- [ ] **Step 1: Create the component**

This component renders type-specific configuration panels and handles auto-save.

```jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import AgentScopePicker from './AgentScopePicker';
import RiskExplainer from './RiskExplainer';

const ACTION_OPTIONS = [
  'build', 'deploy', 'post', 'apply', 'security', 'message', 'api',
  'calendar', 'research', 'review', 'fix', 'refactor', 'test', 'config',
  'monitor', 'alert', 'cleanup', 'sync', 'migrate', 'other',
];

const DECISION_OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'require_approval', label: 'Require Approval' },
  { value: 'warn', label: 'Warn' },
];

const WINDOW_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 60, label: '1 hour' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: '24 hours' },
];

function parseRules(policy) {
  try { return JSON.parse(policy?.rules || '{}'); } catch { return {}; }
}

function parseAgentIds(policy) {
  if (!policy?.agent_ids) return [];
  try { const p = JSON.parse(policy.agent_ids); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function ShieldConfig({ shield, policy, onSaved }) {
  const rules = parseRules(policy);
  const [config, setConfig] = useState({ ...shield.defaultRules, ...rules });
  const [agentIds, setAgentIds] = useState(parseAgentIds(policy));
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef(null);

  const save = (newConfig, newAgentIds) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const payload = {
          id: policy.id,
          rules: JSON.stringify({ ...newConfig, _shield: shield.id }),
          agent_ids: newAgentIds.length > 0 ? JSON.stringify(newAgentIds) : null,
        };
        const res = await fetch('/api/policies', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
          onSaved?.();
        }
      } catch { /* ignore */ }
    }, 500);
  };

  const updateConfig = (key, value) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    save(next, agentIds);
  };

  const updateAgentIds = (ids) => {
    setAgentIds(ids);
    save(config, ids);
  };

  const resetDefaults = () => {
    setConfig({ ...shield.defaultRules });
    setAgentIds([]);
    save({ ...shield.defaultRules }, []);
  };

  return (
    <div className="mt-4 space-y-4 border-t border-white/[0.04] pt-4">
      {/* Type-specific fields */}
      {shield.policyType === 'risk_threshold' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Risk Threshold</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min="0" max="100" value={config.threshold || 70}
                onChange={e => updateConfig('threshold', parseInt(e.target.value, 10))}
                className="flex-1 accent-brand"
              />
              <span className={`font-mono text-sm font-medium w-8 text-right ${
                (config.threshold || 70) >= 70 ? 'text-red-400' : (config.threshold || 70) >= 30 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {config.threshold || 70}
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
              <span>Low risk</span><span>Medium</span><span>High risk</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Action</label>
            <select value={config.action || 'block'} onChange={e => updateConfig('action', e.target.value)} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
              {DECISION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <RiskExplainer />
        </div>
      )}

      {(shield.policyType === 'require_approval' || shield.policyType === 'block_action_type') && (
        <div>
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Action Types</label>
          <div className="flex flex-wrap gap-1.5">
            {ACTION_OPTIONS.map(type => {
              const active = (config.action_types || []).includes(type);
              return (
                <button
                  key={type}
                  onClick={() => {
                    const types = active
                      ? (config.action_types || []).filter(t => t !== type)
                      : [...(config.action_types || []), type];
                    updateConfig('action_types', types);
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    active ? 'bg-brand/15 border border-brand/40 text-brand' : 'bg-white/5 border border-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {shield.policyType === 'rate_limit' && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Max Actions</label>
            <input type="number" min="1" value={config.max_actions || 30} onChange={e => updateConfig('max_actions', parseInt(e.target.value, 10) || 1)} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Time Window</label>
            <select value={config.window_minutes || 60} onChange={e => updateConfig('window_minutes', parseInt(e.target.value, 10))} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
              {WINDOW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Action</label>
            <select value={config.action || 'warn'} onChange={e => updateConfig('action', e.target.value)} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
              {DECISION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {shield.policyType === 'semantic_check' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Instruction</label>
            <textarea value={config.instruction || ''} onChange={e => updateConfig('instruction', e.target.value)} rows={3} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50 resize-none" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Fallback</label>
            <select value={config.fallback || 'allow'} onChange={e => updateConfig('fallback', e.target.value)} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
              <option value="allow">Allow (fail-open)</option>
              <option value="block">Block (fail-closed)</option>
            </select>
            <div className="mt-1 text-[10px] text-zinc-500">Requires GUARD_LLM_KEY or OPENAI_API_KEY environment variable.</div>
          </div>
        </div>
      )}

      {shield.policyType === 'webhook_check' && (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Webhook URL (HTTPS)</label>
            <input type="url" value={config.url || ''} onChange={e => updateConfig('url', e.target.value)} placeholder="https://api.example.com/guard" className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Timeout</label>
              <select value={config.timeout_ms || 5000} onChange={e => updateConfig('timeout_ms', parseInt(e.target.value, 10))} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
                <option value="1000">1 second</option>
                <option value="3000">3 seconds</option>
                <option value="5000">5 seconds</option>
                <option value="10000">10 seconds</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">On Timeout</label>
              <select value={config.on_timeout || 'allow'} onChange={e => updateConfig('on_timeout', e.target.value)} className="w-full rounded-lg border border-white/5 bg-surface-tertiary px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
                <option value="allow">Allow (fail-open)</option>
                <option value="block">Block (fail-closed)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Agent scope — shared across all types */}
      <AgentScopePicker agentIds={agentIds} onChange={updateAgentIds} />

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={resetDefaults} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          Reset to defaults
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/ShieldConfig.jsx
git commit -m "feat: add ShieldConfig component with type-specific panels"
```

---

### Task 6: Build ShieldCard component

**Files:**
- Create: `app/policies/components/ShieldCard.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client';

import { useState } from 'react';
import {
  Rocket, AlertTriangle, ShieldAlert, Ban, Timer, Globe, Lock, MessageSquare,
} from 'lucide-react';
import ShieldConfig from './ShieldConfig';

const ICON_MAP = {
  Rocket, AlertTriangle, ShieldAlert, Ban, Timer, Globe, Lock, MessageSquare,
};

export default function ShieldCard({ shield, policy, onToggle, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const isActive = policy && policy.active === 1;
  const Icon = ICON_MAP[shield.icon] || ShieldAlert;

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(shield, policy, !isActive);
    setToggling(false);
  };

  // Parse stats from policy if available
  let statsText = null;
  if (isActive && policy?.stats) {
    const parts = [];
    if (policy.stats.blocks > 0) parts.push(`${policy.stats.blocks} blocked`);
    if (policy.stats.approvals > 0) parts.push(`${policy.stats.approvals} approvals`);
    if (policy.stats.warns > 0) parts.push(`${policy.stats.warns} warns`);
    if (parts.length > 0) statsText = parts.join(' \u00b7 ');
  }

  const agentIds = (() => {
    if (!policy?.agent_ids) return [];
    try { const p = JSON.parse(policy.agent_ids); return Array.isArray(p) ? p : []; } catch { return []; }
  })();

  return (
    <div className={`rounded-2xl border transition-colors ${
      isActive ? 'border-brand/30 bg-[#111]' : 'border-[rgba(255,255,255,0.06)] bg-[#111] opacity-60'
    }`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isActive ? 'bg-brand/10 text-brand' : 'bg-white/5 text-zinc-500'
            }`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">{shield.name}</div>
              <div className="text-xs text-zinc-400 mt-0.5">{shield.description}</div>
            </div>
          </div>

          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              isActive ? 'bg-brand' : 'bg-zinc-700'
            } ${toggling ? 'opacity-50' : ''}`}
            aria-label={`${isActive ? 'Disable' : 'Enable'} ${shield.name}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              isActive ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {/* Stats strip */}
        {isActive && statsText && (
          <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
            {statsText}
          </div>
        )}

        {/* Agent scope + configure */}
        {isActive && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {agentIds.length === 0 ? 'All agents' : `${agentIds.length} agent${agentIds.length === 1 ? '' : 's'}`}
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-brand hover:text-brand/80 transition-colors"
            >
              {expanded ? 'Close' : 'Configure'}
            </button>
          </div>
        )}

        {/* Expanded config */}
        {isActive && expanded && policy && (
          <ShieldConfig shield={shield} policy={policy} onSaved={onSaved} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/ShieldCard.jsx
git commit -m "feat: add ShieldCard component with toggle and expand"
```

---

### Task 7: Build ShieldsGrid component

**Files:**
- Create: `app/policies/components/ShieldsGrid.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Skeleton } from '../../components/ui/Skeleton';
import { SHIELDS, matchShieldsToPolices, buildShieldPayload } from '../lib/shields';
import ShieldCard from './ShieldCard';

export default function ShieldsGrid() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const shieldMap = matchShieldsToPolices(policies);

  const handleToggle = async (shield, policy, activate) => {
    if (activate && !policy) {
      // Create new shield policy
      const payload = buildShieldPayload(shield);
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) await fetchPolicies();
    } else if (activate && policy) {
      // Re-activate existing policy
      await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, active: 1 }),
      });
      await fetchPolicies();
    } else if (!activate && policy) {
      // Deactivate
      await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, active: 0 }),
      });
      await fetchPolicies();
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {SHIELDS.map(shield => (
        <ShieldCard
          key={shield.id}
          shield={shield}
          policy={shieldMap.get(shield.id)}
          onToggle={handleToggle}
          onSaved={fetchPolicies}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/ShieldsGrid.jsx
git commit -m "feat: add ShieldsGrid component"
```

---

### Task 8: Build ActivityTab component

**Files:**
- Create: `app/policies/components/ActivityTab.jsx`

- [ ] **Step 1: Create the component**

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import Link from 'next/link';

const decisionVariant = {
  block: 'error',
  require_approval: 'warning',
  warn: 'info',
  allow: 'success',
};

const decisionDot = {
  block: 'bg-red-500',
  require_approval: 'bg-amber-500',
  warn: 'bg-yellow-500',
  allow: 'bg-emerald-500',
};

function formatRelativeTime(isoString) {
  if (!isoString) return '\u2014';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityTab() {
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState({ blocks: 0, approvals: 0, warns: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterDecision, setFilterDecision] = useState('');
  const [offset, setOffset] = useState(0);

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', offset.toString());
      if (filterDecision) params.set('decision', filterDecision);
      const res = await fetch(`/api/guard/decisions?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setDecisions(data.decisions || []);
        } else {
          setDecisions(prev => [...prev, ...(data.decisions || [])]);
        }
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch guard decisions:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDecision, offset]);

  useEffect(() => { setOffset(0); }, [filterDecision]);
  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span><span className="text-red-400 font-medium">{stats.blocks}</span> blocks (7d)</span>
        <span>&middot;</span>
        <span><span className="text-amber-400 font-medium">{stats.approvals}</span> approvals (7d)</span>
        <span>&middot;</span>
        <span><span className="text-yellow-400 font-medium">{stats.warns}</span> warns (7d)</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)} className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
          <option value="">All decisions</option>
          <option value="block">Blocked</option>
          <option value="require_approval">Require Approval</option>
          <option value="warn">Warn</option>
          <option value="allow">Allowed</option>
        </select>
      </div>

      {/* Feed */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
        {loading && decisions.length === 0 ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-500">No guard decisions yet.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {decisions.map(d => (
              <div key={d.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${decisionDot[d.decision] || 'bg-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={decisionVariant[d.decision] || 'default'} size="xs">{d.decision}</Badge>
                      <span className="text-xs text-zinc-500">{d.action_type}</span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-400">{d.agent_name || d.agent_id || 'unknown'}</span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-500">{formatRelativeTime(d.created_at)}</span>
                    </div>
                    {d.matched_policies?.length > 0 && (
                      <div className="mt-1 text-xs text-zinc-500">
                        Policy: <span className="text-zinc-300">{d.matched_policies.join(', ')}</span>
                      </div>
                    )}
                    {d.risk_score != null && (
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Risk: <span className={`font-mono ${d.risk_score >= 70 ? 'text-red-400' : d.risk_score >= 30 ? 'text-amber-400' : 'text-zinc-300'}`}>{d.risk_score}</span>
                      </div>
                    )}
                    {d.declared_goal && (
                      <div className="mt-1 text-xs text-zinc-400 truncate">{d.declared_goal}</div>
                    )}
                    {d.reason && (
                      <div className="mt-0.5 text-xs text-zinc-500">{d.reason}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {decisions.length < total && (
          <div className="border-t border-white/[0.04] px-5 py-3 text-center">
            <button onClick={() => setOffset(decisions.length)} disabled={loading} className="text-xs text-brand hover:text-brand/80 disabled:opacity-50">
              {loading ? 'Loading...' : `Load more (${decisions.length} of ${total})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/ActivityTab.jsx
git commit -m "feat: add ActivityTab component with guard decision feed"
```

---

### Task 9: Build CustomTab component

**Files:**
- Create: `app/policies/components/CustomTab.jsx`

- [ ] **Step 1: Create the component**

This reuses the existing `PolicyAuthoringPanel` and `PolicyAdvancedImportPanel` components.

```jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, Sparkles, BookOpen, Trash2, Play, Copy, Check, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import PolicyAuthoringPanel from './PolicyAuthoringPanel';
import PolicyAdvancedImportPanel from './PolicyAdvancedImportPanel';

function formatRules(policy) {
  const type = policy.policy_type;
  let rules;
  try { rules = JSON.parse(policy.rules || '{}'); } catch { return type; }
  switch (type) {
    case 'risk_threshold': return `Risk >= ${rules.threshold} \u2192 ${rules.action || 'block'}`;
    case 'require_approval': return `${(rules.action_types || []).join(', ')} \u2192 require approval`;
    case 'block_action_type': return `${(rules.action_types || []).join(', ')} \u2192 block`;
    case 'rate_limit': return `Max ${rules.max_actions} / ${rules.window_minutes}min \u2192 ${rules.action || 'warn'}`;
    case 'webhook_check': { try { return `Webhook \u2192 ${new URL(rules.url).hostname}`; } catch { return 'Webhook'; } }
    case 'semantic_check': return `Semantic: "${(rules.instruction || '').slice(0, 50)}..."`;
    default: return type;
  }
}

function parseAgentIds(policy) {
  if (!policy.agent_ids) return [];
  try { const p = JSON.parse(policy.agent_ids); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function CustomTab() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [showAuthoring, setShowAuthoring] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data.policies || []);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const filtered = policies.filter(p => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && p.policy_type !== filterType) return false;
    if (filterActive === 'active' && p.active !== 1) return false;
    if (filterActive === 'inactive' && p.active !== 0) return false;
    return true;
  });

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await fetch(`/api/policies?id=${id}`, { method: 'DELETE' });
      await fetchPolicies();
    } catch { /* ignore */ }
    finally { setDeleting(false); setConfirmDeleteId(null); }
  };

  const handleToggleActive = async (policy) => {
    await fetch('/api/policies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: policy.id, active: policy.active === 1 ? 0 : 1 }),
    });
    await fetchPolicies();
  };

  const handleExport = async (policy) => {
    const json = JSON.stringify({ name: policy.name, policy_type: policy.policy_type, rules: policy.rules, agent_ids: policy.agent_ids }, null, 2);
    await navigator.clipboard.writeText(json);
    setCopiedId(policy.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSimulate = async (policy) => {
    let rules;
    try { rules = JSON.parse(policy.rules); } catch { return; }
    const res = await fetch('/api/policies/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_type: policy.policy_type, rules, days: 7 }),
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Simulation (7d): ${data.summary?.matches || 0} matches \u2014 ${data.summary?.block || 0} blocks, ${data.summary?.warn || 0} warns, ${data.summary?.require_approval || 0} approvals`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => { setEditingPolicy(null); setShowAuthoring(true); setShowImport(false); }} className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs text-brand hover:border-brand/60 transition-colors">
          <Plus size={12} /> New Policy
        </button>
        <button onClick={() => { setShowImport(true); setShowAuthoring(false); }} className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors">
          <Upload size={12} /> Import
        </button>
        <button onClick={() => { setEditingPolicy(null); setShowAuthoring(true); setShowImport(false); }} className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors">
          <Sparkles size={12} /> AI Generator
        </button>
      </div>

      {/* Authoring panel */}
      {showAuthoring && (
        <PolicyAuthoringPanel
          editingPolicy={editingPolicy}
          onClose={() => { setShowAuthoring(false); setEditingPolicy(null); }}
          onSaved={() => { setShowAuthoring(false); setEditingPolicy(null); fetchPolicies(); }}
        />
      )}

      {/* Import panel */}
      {showImport && (
        <PolicyAdvancedImportPanel
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchPolicies(); }}
        />
      )}

      {/* Search + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text" placeholder="Search policies..." value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-white/5 bg-surface-tertiary px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand/50"
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
          <option value="">All types</option>
          <option value="risk_threshold">Risk Threshold</option>
          <option value="require_approval">Require Approval</option>
          <option value="block_action_type">Block Action Type</option>
          <option value="rate_limit">Rate Limit</option>
          <option value="webhook_check">Webhook Check</option>
          <option value="semantic_check">Semantic Check</option>
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)} className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand/50">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Policy list */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12">
            <EmptyState icon={Plus} title="No policies" description="Create your first policy or import a template pack." />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(p => {
              const agentCount = parseAgentIds(p).length;
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{p.name}</span>
                      <Badge size="xs">{p.policy_type}</Badge>
                      <Badge variant={p.active === 1 ? 'success' : 'default'} size="xs">{p.active === 1 ? 'active' : 'inactive'}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500 truncate">
                      {formatRules(p)} &middot; {agentCount === 0 ? 'All agents' : `${agentCount} agents`} &middot; {p.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggleActive(p)} className="text-zinc-500 hover:text-white" title={p.active === 1 ? 'Deactivate' : 'Activate'}>
                      {p.active === 1 ? <ToggleRight size={16} className="text-brand" /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={() => { setEditingPolicy(p); setShowAuthoring(true); setShowImport(false); }} className="text-zinc-500 hover:text-white" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleSimulate(p)} className="text-zinc-500 hover:text-white" title="Simulate">
                      <Play size={13} />
                    </button>
                    <button onClick={() => handleExport(p)} className="text-zinc-500 hover:text-white" title="Export JSON">
                      {copiedId === p.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    {confirmDeleteId === p.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button onClick={() => handleDelete(p.id)} disabled={deleting} className="text-red-400 hover:text-red-300 disabled:opacity-50">{deleting ? '...' : 'Yes'}</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-zinc-400 hover:text-white">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(p.id)} className="text-zinc-500 hover:text-red-400" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/policies/components/CustomTab.jsx
git commit -m "feat: add CustomTab component with policy list and actions"
```

---

### Task 10: Replace the policies page

**Files:**
- Modify: `app/policies/page.jsx`

- [ ] **Step 1: Replace the page**

Replace the entire content of `app/policies/page.jsx`:

```jsx
'use client';

import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import ShieldsGrid from './components/ShieldsGrid';
import CustomTab from './components/CustomTab';
import ActivityTab from './components/ActivityTab';

const TABS = [
  { id: 'shields', label: 'Shields' },
  { id: 'custom', label: 'Custom' },
  { id: 'activity', label: 'Activity' },
];

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState('shields');
  const [stats, setStats] = useState({ active: 0, blocks: 0, approvals: 0, agents: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [policiesRes, decisionsRes, agentsRes] = await Promise.all([
          fetch('/api/policies'),
          fetch('/api/guard/decisions?limit=1'),
          fetch('/api/agents'),
        ]);
        const policiesData = policiesRes.ok ? await policiesRes.json() : { policies: [] };
        const decisionsData = decisionsRes.ok ? await decisionsRes.json() : { stats: {} };
        const agentsData = agentsRes.ok ? await agentsRes.json() : { agents: [] };
        setStats({
          active: (policiesData.policies || []).filter(p => p.active === 1).length,
          blocks: decisionsData.stats?.blocks || 0,
          approvals: decisionsData.stats?.approvals || 0,
          agents: (agentsData.agents || []).length,
        });
      } catch { /* ignore */ }
    };
    fetchStats();
  }, []);

  return (
    <PageLayout
      title="Policies"
      subtitle="Governance shields and guard rules"
      breadcrumbs={['Governance', 'Policies']}
      maturity="stable"
    >
      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-3 text-xs text-zinc-400">
        <span><span className="text-white font-medium">{stats.active}</span> active shields</span>
        <span className="text-zinc-600">&middot;</span>
        <span><span className="text-red-400 font-medium">{stats.blocks}</span> blocks this week</span>
        <span className="text-zinc-600">&middot;</span>
        <span><span className="text-amber-400 font-medium">{stats.approvals}</span> approvals this week</span>
        <span className="text-zinc-600">&middot;</span>
        <span><span className="text-white font-medium">{stats.agents}</span> agents governed</span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-[rgba(255,255,255,0.06)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'shields' && <ShieldsGrid />}
      {activeTab === 'custom' && <CustomTab />}
      {activeTab === 'activity' && <ActivityTab />}
    </PageLayout>
  );
}
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/policies/page.jsx
git commit -m "feat: replace policies page with shields-first experience"
```

---

### Task 11: Final integration and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: Clean

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`
Verify:
- `/policies` loads with Shields tab showing 8 shield cards
- Toggling a shield on creates a policy (check via Custom tab)
- Toggling off deactivates it
- Configure expands with type-specific fields
- Risk Explainer opens and shows score breakdown
- Custom tab lists all policies with edit/delete/simulate/export
- Activity tab shows guard decisions (if any exist)
- Stats bar shows correct counts

- [ ] **Step 4: Commit spec + plan docs**

```bash
git add docs/superpowers/specs/2026-04-09-policy-builder-design.md docs/superpowers/plans/2026-04-09-policy-builder.md
git commit -m "docs: add policy builder design spec and implementation plan"
```
