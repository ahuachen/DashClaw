# DashClaw Must-Steal Features — Phase 1 Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Execution Studio" layer on top of DashClaw's governance substrate: a read-only execution graph, reusable workflow templates, model strategy records, knowledge collection bindings, and a capability registry — without breaking the minimal runtime boundary.

**Architecture:** Extend existing patterns — flat `app/<feature>/` UI directories, matching `app/api/<feature>/` routes (after governance allowlist update), `app/lib/repositories/<feature>.repository.js` data access, and `drizzle/0000_clammy_falcon.sql` schema additions picked up by `scripts/auto-migrate.mjs` at deploy time. No new frameworks. No parallel architecture.

**Tech Stack:** Next.js 15 App Router, Postgres (Neon) via `postgres.js` tagged templates, Vitest + jsdom, Tailwind + in-house Card/Badge/PageLayout components, lucide-react icons.

**Source spec:** `C:\Users\sandm\clawd\docs\dashclaw-must-steals-build-spec-for-claude-code.txt`

---

## Scope Note (Read First)

This spec bundles **5 independent subsystems**. Per the writing-plans skill each should ideally be its own plan. Because the user's brief is a single Phase 1 delivery, this plan keeps them together but orders them so work can be **cut cleanly** at any feature boundary and still ship a usable product:

| Order | Feature | Schema risk | UI scope | Cut-friendly? |
|---|---|---|---|---|
| 1 | Execution Graph View | **zero** (reuses trace data) | decision replay tab | ✅ ship alone |
| 2 | Workflow Templates | 1 new table | list/detail/form | ✅ ship alone |
| 3 | Model Strategy Layer | 1 new table + 2 nullable cols | list/form | depends on #2 for linkage |
| 4 | Knowledge Collections | 2 new tables | list/detail | ✅ ship alone |
| 5 | Capability Registry | 1 new table | searchable registry | ✅ ship alone |

**Cut line rule:** If scope must shrink, ship in this order and stop anywhere — each prior feature is complete on its own.

### Hard constraints

- All CI checks must pass: `npm run lint`, `npm run governance:boundary:check`, `npm run openapi:check`, `npm run test -- --run`.
- Per `CLAUDE.md`: additive only, org-scoped, no secrets, no breaking existing routes, no refactors unless required.
- Per user memory: no PRs (commit and push to main), Vercel free tier, schema must auto-apply on deploy.
- Per user memory SDK checklist: any new SDK method requires updates to 7 doc files. **This plan adds routes only (no SDK methods)** to avoid expanding that surface until Phase 2.

---

## Complete File Structure

### Preflight

- Modify: `scripts/check-api-boundary.mjs:17-59` — add `workflows`, `model-strategies`, `knowledge`, `capabilities` to `ALLOWED_RUNTIME_ROUTES`.
- Modify: `drizzle/0000_clammy_falcon.sql` (append) — 5 new `CREATE TABLE` statements.

### Feature 1: Execution Graph View

- Modify: `app/lib/repositories/actions.repository.js` — add `buildActionGraph(sql, orgId, actionId)`.
- Create: `app/api/actions/[actionId]/graph/route.js` — `GET` endpoint.
- Create: `app/components/ExecutionGraph.js` — read-only SVG node/edge renderer.
- Modify: `app/decisions/[actionId]/page.js` — add `graph` tab between existing tabs.
- Create: `__tests__/unit/action-graph.repository.test.js`
- Create: `__tests__/unit/action-graph.route.test.js`

### Feature 2: Workflow Templates

- Create: `app/lib/repositories/workflow-templates.repository.js`
- Create: `app/api/workflows/templates/route.js` (GET list, POST create)
- Create: `app/api/workflows/templates/[templateId]/route.js` (GET, PATCH)
- Create: `app/api/workflows/templates/[templateId]/duplicate/route.js` (POST)
- Create: `app/api/workflows/templates/[templateId]/launch/route.js` (POST)
- Create: `app/workflows/page.js` — list + empty state
- Create: `app/workflows/[templateId]/page.js` — detail view
- Create: `app/workflows/new/page.js` — create form
- Create: `__tests__/unit/workflow-templates.repository.test.js`
- Create: `__tests__/unit/workflow-templates.route.test.js`

### Feature 3: Model Strategy Layer

- Create: `app/lib/repositories/model-strategies.repository.js`
- Create: `app/api/model-strategies/route.js` (GET, POST)
- Create: `app/api/model-strategies/[strategyId]/route.js` (GET, PATCH, DELETE)
- Create: `app/model-strategies/page.js`
- Create: `app/model-strategies/[strategyId]/page.js`
- Modify: `app/lib/repositories/workflow-templates.repository.js` — resolve strategy on launch.
- Modify: Feature 2 routes to accept `model_strategy_id`.
- Create: `__tests__/unit/model-strategies.repository.test.js`

### Feature 4: Knowledge Collections

- Create: `app/lib/repositories/knowledge.repository.js`
- Create: `app/api/knowledge/collections/route.js` (GET, POST)
- Create: `app/api/knowledge/collections/[collectionId]/route.js` (GET, PATCH)
- Create: `app/api/knowledge/collections/[collectionId]/items/route.js` (GET, POST)
- Create: `app/knowledge/page.js`
- Create: `app/knowledge/[collectionId]/page.js`
- Create: `__tests__/unit/knowledge.repository.test.js`

### Feature 5: Capability Registry

- Create: `app/lib/repositories/capabilities.repository.js`
- Create: `app/api/capabilities/route.js` (GET, POST)
- Create: `app/api/capabilities/[capabilityId]/route.js` (GET, PATCH)
- Create: `app/capabilities/page.js` — searchable registry with badges
- Create: `__tests__/unit/capabilities.repository.test.js`

### Final integration

- Modify: `app/components/Sidebar.js:16-60` — add "Studio" nav group (Workflows, Model Strategies, Knowledge, Capabilities).
- Verify: `npm run governance:boundary:check` passes.
- Verify: `npm run test -- --run` passes.

---

## Preflight Tasks

### Task P1: Update governance boundary allowlist

**Files:**
- Modify: `scripts/check-api-boundary.mjs:17-59`

- [ ] **Step 1: Add the 4 new Tier-2 governance extensions**

In `scripts/check-api-boundary.mjs`, add entries to `ALLOWED_RUNTIME_ROUTES` under the Tier 2 section:

```js
  // Tier 2: Governance Extensions (Active)
  'compliance',
  'drift',
  'evaluations',
  'messages',
  'prompts',
  'scoring',
  'webhooks',
  'swarm',
  'learning',
  'workflows',         // Execution Studio: reusable workflow template packaging
  'model-strategies',  // Execution Studio: model/provider strategy records
  'knowledge',         // Execution Studio: knowledge collection metadata + bindings
  'capabilities',      // Execution Studio: governed capability registry
```

- [ ] **Step 2: Verify the check still passes with no new routes yet**

Run: `npm run governance:boundary:check`
Expected: `✅ Boundary check passed. Runtime is clean.`

- [ ] **Step 3: Commit**

```bash
git add scripts/check-api-boundary.mjs
git commit -m "chore(boundary): allowlist 4 Execution Studio extensions"
```

---

### Task P2: Add schema for new tables to drizzle DDL

**Files:**
- Modify: `drizzle/0000_clammy_falcon.sql` (append at end)

Existing DDL uses `CREATE TABLE "name" (...)` without `IF NOT EXISTS`, but `auto-migrate.mjs` catches `42P07 duplicate_table` so re-runs are safe. Follow the same style.

- [ ] **Step 1: Append the 5 tables to the DDL file**

Append to `drizzle/0000_clammy_falcon.sql`:

```sql
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"template_id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"objective" text,
	"steps_json" text DEFAULT '[]',
	"model_strategy_id" text,
	"model_strategy_snapshot" text,
	"linked_prompt_template_ids_json" text DEFAULT '[]',
	"linked_policy_ids_json" text DEFAULT '[]',
	"linked_knowledge_collection_ids_json" text DEFAULT '[]',
	"linked_capability_ids_json" text DEFAULT '[]',
	"linked_capability_tags_json" text DEFAULT '[]',
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "workflow_templates_org_slug_unique" UNIQUE("org_id", "slug")
);
--> statement-breakpoint
CREATE TABLE "model_strategies" (
	"strategy_id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config_json" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_collections" (
	"collection_id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_type" text DEFAULT 'files' NOT NULL,
	"tags_json" text DEFAULT '[]',
	"ingestion_status" text DEFAULT 'empty' NOT NULL,
	"doc_count" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_collection_items" (
	"item_id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"source_uri" text NOT NULL,
	"title" text,
	"mime_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata_json" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capabilities" (
	"capability_id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category" text,
	"source_type" text DEFAULT 'internal_sdk' NOT NULL,
	"auth_type" text DEFAULT 'none',
	"risk_level" text DEFAULT 'medium' NOT NULL,
	"requires_approval" integer DEFAULT 0 NOT NULL,
	"tags_json" text DEFAULT '[]',
	"pricing_json" text DEFAULT '{}',
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"docs_url" text,
	"invocation_schema_json" text DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "capabilities_org_slug_unique" UNIQUE("org_id", "slug")
);
```

**Design notes:**
- All JSON columns use `text` (not `jsonb`) to match existing project convention (`systems_touched`, `side_effects`, etc. are all `text`).
- `org_id` defaults to `org_default` to match existing pattern and not break single-tenant deploys.
- Timestamps use `timestamp` (not `text`) for the newer tables to match recent `action_records` convention.
- Unique constraint on `(org_id, slug)` for templates and capabilities so operators can't shadow slugs within an org.

- [ ] **Step 2: Run auto-migrate locally to verify DDL is valid**

Run: `node scripts/auto-migrate.mjs`
Expected: `Migration complete` with no errors for the new tables.

- [ ] **Step 3: Commit**

```bash
git add drizzle/0000_clammy_falcon.sql
git commit -m "feat(db): add Execution Studio tables (workflows, strategies, knowledge, capabilities)"
```

---

## Feature 1: Execution Graph View (TDD — full detail)

### Task 1.1: Repository — `buildActionGraph`

**Files:**
- Modify: `app/lib/repositories/actions.repository.js` (append near `getActionTraceData`)
- Create: `__tests__/unit/action-graph.repository.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/action-graph.repository.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildActionGraph } from '@/lib/repositories/actions.repository.js';

const mockSql = vi.fn();

function stubSqlSequence(...responses) {
  mockSql.mockReset();
  let i = 0;
  mockSql.mockImplementation(() => Promise.resolve(responses[i++] || []));
}

describe('buildActionGraph', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when root action not found', async () => {
    // getActionTraceData fetches the action first; no rows => null
    stubSqlSequence([]);
    const graph = await buildActionGraph(mockSql, 'org_1', 'act_missing');
    expect(graph).toBeNull();
  });

  it('builds nodes and edges from trace data with parent, sub-actions, assumptions, loops', async () => {
    const rootAction = {
      action_id: 'act_root', agent_id: 'agent_1', action_type: 'deploy',
      declared_goal: 'Release hotfix', status: 'completed', risk_score: 82,
      timestamp_start: '2026-04-05T10:00:00Z', timestamp_end: '2026-04-05T10:02:00Z',
      parent_action_id: 'act_parent', systems_touched: '[]'
    };
    const parentAction = {
      action_id: 'act_parent', agent_id: 'agent_1', action_type: 'plan',
      declared_goal: 'Release plan', status: 'completed', risk_score: 30,
      timestamp_start: '2026-04-05T09:55:00Z', parent_action_id: null
    };
    const subAction = {
      action_id: 'act_child', agent_id: 'agent_1', action_type: 'test',
      declared_goal: 'Smoke test', status: 'completed', risk_score: 10,
      timestamp_start: '2026-04-05T10:01:00Z'
    };
    const assumption = {
      assumption_id: 'as_1', action_id: 'act_root',
      assumption: 'DB is read-only', validated: 0, invalidated: 1,
      invalidated_reason: 'Write detected', created_at: '2026-04-05T10:00:30Z'
    };
    const loop = {
      loop_id: 'lp_1', action_id: 'act_root', loop_type: 'verification',
      description: 'Verify rollback', status: 'open', priority: 'high',
      created_at: '2026-04-05T10:01:30Z'
    };

    // getActionTraceData call order: action, [assumptions, loops, related, subActions] (parallel, but mocked sequentially)
    // then parent chain lookup
    stubSqlSequence(
      [rootAction],          // initial action fetch
      [assumption],          // assumptions
      [loop],                // loops
      [],                    // relatedActions
      [subAction],           // subActions
      [parentAction],        // parent chain step 1
    );

    const graph = await buildActionGraph(mockSql, 'org_1', 'act_root');

    expect(graph.rootActionId).toBe('act_root');
    const nodeIds = graph.nodes.map(n => n.id);
    expect(nodeIds).toContain('action:act_root');
    expect(nodeIds).toContain('action:act_parent');
    expect(nodeIds).toContain('action:act_child');
    expect(nodeIds).toContain('assumption:as_1');
    expect(nodeIds).toContain('loop:lp_1');

    const rootNode = graph.nodes.find(n => n.id === 'action:act_root');
    expect(rootNode.type).toBe('action');
    expect(rootNode.status).toBe('completed');
    expect(rootNode.riskScore).toBe(82);

    const edges = graph.edges;
    expect(edges).toContainEqual(expect.objectContaining({
      source: 'action:act_parent', target: 'action:act_root', type: 'parent_child'
    }));
    expect(edges).toContainEqual(expect.objectContaining({
      source: 'action:act_root', target: 'action:act_child', type: 'parent_child'
    }));
    expect(edges).toContainEqual(expect.objectContaining({
      source: 'assumption:as_1', target: 'action:act_root', type: 'assumption_of'
    }));
    expect(edges).toContainEqual(expect.objectContaining({
      source: 'loop:lp_1', target: 'action:act_root', type: 'loop_from'
    }));

    // invalidated assumption surfaces in node meta
    const asNode = graph.nodes.find(n => n.id === 'assumption:as_1');
    expect(asNode.status).toBe('invalidated');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test -- --run action-graph.repository`
Expected: FAIL — `buildActionGraph is not a function`.

- [ ] **Step 3: Implement `buildActionGraph`**

Append to `app/lib/repositories/actions.repository.js` (after `getActionTraceData`):

```js
/**
 * Build a graph payload (nodes + edges) for an action, reusing trace data plus
 * correlated governance artifacts. Read-only view for the Execution Graph UI.
 */
export async function buildActionGraph(sql, orgId, actionId) {
  const trace = await getActionTraceData(sql, orgId, actionId);
  if (!trace) return null;

  const { action, assumptions, loops, relatedActions, subActions, parentChain } = trace;
  const nodes = [];
  const edges = [];
  const seenNodes = new Set();

  const pushNode = (node) => {
    if (seenNodes.has(node.id)) return;
    seenNodes.add(node.id);
    nodes.push(node);
  };

  const actionNode = (a, { isRoot = false } = {}) => ({
    id: `action:${a.action_id}`,
    type: 'action',
    label: a.declared_goal || a.action_type || a.action_id,
    status: a.status || 'unknown',
    riskScore: a.risk_score ?? null,
    agentId: a.agent_id || null,
    agentName: a.agent_name || null,
    actionType: a.action_type || null,
    timestamp: a.timestamp_start || null,
    isRoot,
    meta: {
      error_message: a.error_message || null,
      parent_action_id: a.parent_action_id || null,
    },
  });

  // Root action
  pushNode(actionNode(action, { isRoot: true }));

  // Parent chain — edges flow parent -> child
  let childId = action.action_id;
  for (const parent of parentChain) {
    pushNode(actionNode(parent));
    edges.push({
      id: `edge:pc:${parent.action_id}->${childId}`,
      source: `action:${parent.action_id}`,
      target: `action:${childId}`,
      type: 'parent_child',
      label: 'spawned',
    });
    childId = parent.action_id;
  }

  // Sub-actions
  for (const sub of subActions || []) {
    pushNode(actionNode(sub));
    edges.push({
      id: `edge:pc:${action.action_id}->${sub.action_id}`,
      source: `action:${action.action_id}`,
      target: `action:${sub.action_id}`,
      type: 'parent_child',
      label: 'spawned',
    });
  }

  // Related actions (same agent/system in nearby time window)
  for (const rel of relatedActions || []) {
    pushNode(actionNode(rel));
    edges.push({
      id: `edge:rel:${rel.action_id}-${action.action_id}`,
      source: `action:${action.action_id}`,
      target: `action:${rel.action_id}`,
      type: 'related',
      label: 'correlated',
    });
  }

  // Assumptions — edge from assumption into the action it supports
  for (const a of assumptions || []) {
    const status = a.invalidated === 1 || a.invalidated === true
      ? 'invalidated'
      : a.validated === 1 || a.validated === true
      ? 'validated'
      : 'unresolved';
    pushNode({
      id: `assumption:${a.assumption_id}`,
      type: 'assumption',
      label: a.assumption,
      status,
      meta: {
        invalidated_reason: a.invalidated_reason || null,
        drift_score: a.drift_score ?? null,
      },
    });
    edges.push({
      id: `edge:as:${a.assumption_id}->${action.action_id}`,
      source: `assumption:${a.assumption_id}`,
      target: `action:${action.action_id}`,
      type: 'assumption_of',
      label: status,
    });
  }

  // Open loops — edge from loop into the action it blocks/questions
  for (const l of loops || []) {
    pushNode({
      id: `loop:${l.loop_id}`,
      type: 'loop',
      label: l.description || l.loop_type || 'Open loop',
      status: l.status || 'open',
      meta: {
        priority: l.priority || null,
        loop_type: l.loop_type || null,
      },
    });
    edges.push({
      id: `edge:lp:${l.loop_id}->${action.action_id}`,
      source: `loop:${l.loop_id}`,
      target: `action:${action.action_id}`,
      type: 'loop_from',
      label: l.priority || 'open',
    });
  }

  return {
    rootActionId: action.action_id,
    nodes,
    edges,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm run test -- --run action-graph.repository`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/repositories/actions.repository.js __tests__/unit/action-graph.repository.test.js
git commit -m "feat(actions): add buildActionGraph repository function"
```

---

### Task 1.2: Route — `GET /api/actions/[actionId]/graph`

**Files:**
- Create: `app/api/actions/[actionId]/graph/route.js`
- Create: `__tests__/unit/action-graph.route.test.js`

- [ ] **Step 1: Write the failing route test**

Create `__tests__/unit/action-graph.route.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockBuildActionGraph, mockGetOrgId } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockBuildActionGraph: vi.fn(),
  mockGetOrgId: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: mockGetOrgId }));
vi.mock('@/lib/repositories/actions.repository.js', () => ({
  buildActionGraph: mockBuildActionGraph,
}));

import { GET } from '@/api/actions/[actionId]/graph/route.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgId.mockReturnValue('org_1');
});

describe('GET /api/actions/[actionId]/graph', () => {
  it('returns 404 when action not found', async () => {
    mockBuildActionGraph.mockResolvedValue(null);
    const req = makeRequest({ url: 'http://t/api/actions/act_x/graph' });
    const res = await GET(req, { params: Promise.resolve({ actionId: 'act_x' }) });
    expect(res.status).toBe(404);
  });

  it('returns graph payload with nodes and edges', async () => {
    mockBuildActionGraph.mockResolvedValue({
      rootActionId: 'act_1',
      nodes: [{ id: 'action:act_1', type: 'action', status: 'completed' }],
      edges: [],
    });
    const req = makeRequest({ url: 'http://t/api/actions/act_1/graph' });
    const res = await GET(req, { params: Promise.resolve({ actionId: 'act_1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rootActionId).toBe('act_1');
    expect(body.nodes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test, confirm FAIL**

Run: `npm run test -- --run action-graph.route`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/api/actions/[actionId]/graph/route.js`:

```js
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { apiErrorResponse } from '../../../../lib/apiErrors.js';
import { buildActionGraph } from '../../../../lib/repositories/actions.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    const graph = await buildActionGraph(sql, orgId, actionId);
    if (!graph) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }
    return NextResponse.json(graph);
  } catch (error) {
    return apiErrorResponse(error, 'ACTION GRAPH GET');
  }
}
```

- [ ] **Step 4: Run test, confirm PASS**

Run: `npm run test -- --run action-graph.route`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/actions/[actionId]/graph/route.js __tests__/unit/action-graph.route.test.js
git commit -m "feat(api): add GET /api/actions/:id/graph endpoint"
```

---

### Task 1.3: UI — `ExecutionGraph` component

**Files:**
- Create: `app/components/ExecutionGraph.js`

- [ ] **Step 1: Build a read-only SVG graph**

Create `app/components/ExecutionGraph.js`:

```js
'use client';

import Link from 'next/link';
import { useMemo } from 'react';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;
const COL_GAP = 60;
const ROW_GAP = 28;

function statusTone(type, status) {
  if (type === 'assumption' && status === 'invalidated') return 'fill-red-500/20 stroke-red-500';
  if (type === 'assumption' && status === 'validated') return 'fill-emerald-500/15 stroke-emerald-500/60';
  if (type === 'loop') return 'fill-amber-500/15 stroke-amber-500/60';
  if (status === 'failed' || status === 'blocked') return 'fill-red-500/20 stroke-red-500';
  if (status === 'pending_approval') return 'fill-purple-500/20 stroke-purple-500';
  if (status === 'completed') return 'fill-emerald-500/10 stroke-emerald-500/50';
  if (status === 'running') return 'fill-sky-500/10 stroke-sky-500/60';
  return 'fill-zinc-500/10 stroke-zinc-500/60';
}

function layoutNodes(graph) {
  if (!graph) return { laidOut: [], width: 0, height: 0 };
  const byType = { action: [], assumption: [], loop: [] };
  for (const n of graph.nodes) {
    if (byType[n.type]) byType[n.type].push(n);
  }

  // Columns: parents | root | children | related, with assumptions/loops in side rail
  const rootId = `action:${graph.rootActionId}`;
  const parents = [];
  const children = [];
  const related = [];
  const seen = new Set([rootId]);

  for (const e of graph.edges) {
    if (e.type === 'parent_child' && e.target === rootId && !seen.has(e.source)) {
      parents.push(e.source); seen.add(e.source);
    } else if (e.type === 'parent_child' && e.source === rootId && !seen.has(e.target)) {
      children.push(e.target); seen.add(e.target);
    } else if (e.type === 'related' && !seen.has(e.target)) {
      related.push(e.target); seen.add(e.target);
    }
  }

  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));
  const columns = [
    { id: 'parents', nodes: parents.map(id => nodeById.get(id)).filter(Boolean) },
    { id: 'root', nodes: [nodeById.get(rootId)].filter(Boolean) },
    { id: 'children', nodes: children.map(id => nodeById.get(id)).filter(Boolean) },
    { id: 'related', nodes: related.map(id => nodeById.get(id)).filter(Boolean) },
  ];

  const laidOut = [];
  const positions = new Map();
  let x = 20;
  let maxHeight = 0;
  for (const col of columns) {
    if (col.nodes.length === 0) continue;
    let y = 20;
    for (const n of col.nodes) {
      positions.set(n.id, { x, y });
      laidOut.push({ ...n, x, y });
      y += NODE_HEIGHT + ROW_GAP;
    }
    maxHeight = Math.max(maxHeight, y);
    x += NODE_WIDTH + COL_GAP;
  }

  // Assumptions + loops: stack below root in a side rail
  const rootPos = positions.get(rootId);
  if (rootPos) {
    let y = maxHeight + 20;
    for (const n of [...byType.assumption, ...byType.loop]) {
      positions.set(n.id, { x: rootPos.x, y });
      laidOut.push({ ...n, x: rootPos.x, y });
      y += NODE_HEIGHT + ROW_GAP;
    }
    maxHeight = Math.max(maxHeight, y);
  }

  const width = x + 20;
  const height = maxHeight + 20;

  return { laidOut, positions, width, height };
}

export default function ExecutionGraph({ graph }) {
  const { laidOut, positions, width, height } = useMemo(() => layoutNodes(graph), [graph]);

  if (!graph || laidOut.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
        No graph data available for this action yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 overflow-auto">
      <svg width={width} height={height} className="block">
        {/* Edges */}
        {graph.edges.map(edge => {
          const s = positions.get(edge.source);
          const t = positions.get(edge.target);
          if (!s || !t) return null;
          const sx = s.x + NODE_WIDTH;
          const sy = s.y + NODE_HEIGHT / 2;
          const tx = t.x;
          const ty = t.y + NODE_HEIGHT / 2;
          const midX = (sx + tx) / 2;
          const path = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
          return (
            <g key={edge.id}>
              <path d={path} fill="none" className="stroke-white/20" strokeWidth="1.5" />
            </g>
          );
        })}
        {/* Nodes */}
        {laidOut.map(node => {
          const href = node.type === 'action' ? `/decisions/${node.id.replace('action:', '')}` : null;
          const rect = (
            <g>
              <rect
                x={node.x} y={node.y}
                width={NODE_WIDTH} height={NODE_HEIGHT}
                rx="8" ry="8"
                className={statusTone(node.type, node.status)}
                strokeWidth="1.5"
              />
              <text x={node.x + 12} y={node.y + 22} className="fill-white text-[11px] font-medium" style={{ fontFamily: 'inherit' }}>
                {(node.label || '').slice(0, 32)}
              </text>
              <text x={node.x + 12} y={node.y + 40} className="fill-zinc-400 text-[10px]">
                {node.type}{node.status ? ` · ${node.status}` : ''}{node.riskScore != null ? ` · risk ${node.riskScore}` : ''}
              </text>
            </g>
          );
          return href ? (
            <Link key={node.id} href={href}>{rect}</Link>
          ) : (
            <g key={node.id}>{rect}</g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit (no test — visual component)**

```bash
git add app/components/ExecutionGraph.js
git commit -m "feat(ui): add ExecutionGraph read-only SVG component"
```

---

### Task 1.4: Wire graph tab into decision replay

**Files:**
- Modify: `app/decisions/[actionId]/page.js` — add `'graph'` tab + data fetch.

- [ ] **Step 1: Add `graph` state + fetch**

In `app/decisions/[actionId]/page.js`, inside the main component:

1. Add `import ExecutionGraph from '../../components/ExecutionGraph';`
2. Add `const [graph, setGraph] = useState(null);`
3. Inside `fetchData()`, after the existing trace fetch, append:

```js
try {
  const graphRes = await fetch(`/api/actions/${actionId}/graph`);
  if (graphRes.ok) {
    const graphData = await graphRes.json();
    setGraph(graphData);
  }
} catch { /* graph is optional */ }
```

4. Locate the existing tab bar (find where `activeTab` is rendered — search for `setActiveTab('timeline')`). Add a new tab button alongside existing tabs:

```jsx
<button
  onClick={() => setActiveTab('graph')}
  className={`px-3 py-1.5 text-xs rounded-md transition ${activeTab === 'graph' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
>
  Graph
</button>
```

5. Add the conditional tab content next to other tab panels:

```jsx
{activeTab === 'graph' && (
  <div className="mt-4">
    <ExecutionGraph graph={graph} />
  </div>
)}
```

- [ ] **Step 2: Smoke test manually**

Run: `npm run dev` → open `/decisions/<anyActionId>` → click Graph tab. Expected: graph renders with at least the root action node. If action has no sub-actions, only one card shows.

- [ ] **Step 3: Commit**

```bash
git add app/decisions/[actionId]/page.js
git commit -m "feat(decisions): add Graph tab to decision replay"
```

---

## Feature 2: Workflow Templates

Each sub-task below follows the same rhythm as Feature 1: test → implement → run → commit. Full test code is abbreviated below because the patterns are identical to Feature 1; when executing, model tests on `__tests__/unit/actions.route.test.js` and `__tests__/unit/agents.repository.test.js`.

### Task 2.1: Repository

**File:** `app/lib/repositories/workflow-templates.repository.js`

Export functions:
- `listWorkflowTemplates(sql, orgId, { status, limit, offset })` — `SELECT ... WHERE org_id = $1` with optional `status` filter, ordered by `updated_at DESC`.
- `getWorkflowTemplate(sql, orgId, templateId)` — single row or null.
- `createWorkflowTemplate(sql, orgId, data)` — generates `template_id = 'wft_' + crypto.randomUUID()`, JSON-stringifies `steps_json` / linked arrays, sets `version = 1`, `status = 'draft'`.
- `updateWorkflowTemplate(sql, orgId, templateId, patch)` — partial update using `COALESCE(NULL::text, ...)` pattern from `updateActionOutcome`. Bumps `version += 1` when `steps_json` changes.
- `duplicateWorkflowTemplate(sql, orgId, templateId, { name, slug })` — read + re-insert with new id.
- `launchWorkflowTemplate(sql, orgId, templateId, { agent_id, trigger, resolvedStrategy })` — inserts a new `action_records` row with `action_type = 'workflow_launch'`, `declared_goal = template.objective`, `trigger = 'workflow:' + templateId`, and stamps `model_strategy_snapshot` in `reasoning` as JSON. Returns `{ action_id, template_id, version }`.

**Test file:** `__tests__/unit/workflow-templates.repository.test.js` covering create → get → update (version bump) → duplicate → launch (verify action_records insert payload shape).

### Task 2.2: Routes

Follow identical route conventions (`dynamic = 'force-dynamic'`, `getOrgId`, `apiErrorResponse`):

| File | Methods | Behavior |
|---|---|---|
| `app/api/workflows/templates/route.js` | GET, POST | List / create |
| `app/api/workflows/templates/[templateId]/route.js` | GET, PATCH | Get / update |
| `app/api/workflows/templates/[templateId]/duplicate/route.js` | POST | Clone |
| `app/api/workflows/templates/[templateId]/launch/route.js` | POST | Creates action record with workflow metadata; returns `{ action, template_id, version }` |

**Launch resolution:** if `template.model_strategy_id` is set, fetch the strategy row, JSON.parse config, and pass as `resolvedStrategy` into `launchWorkflowTemplate`. The snapshot lands in the action record's `reasoning` field as `WORKFLOW_LAUNCH_META=<json>`.

### Task 2.3: UI

- `app/workflows/page.js` — list with `PageLayout`, `Card` per template showing name, status badge, linked counts. Empty state → "Create your first workflow template" button.
- `app/workflows/new/page.js` — form with fields: name, slug (auto from name), description, objective, steps (JSON textarea for Phase 1), linked IDs (multi-select populated from existing prompts / policies / knowledge / capabilities / model-strategies endpoints).
- `app/workflows/[templateId]/page.js` — detail with:
  - Header: name, status, version
  - Linked resources cards (strategies, knowledge, capabilities, prompts, policies)
  - "Launch" button → POSTs to `/api/workflows/templates/{id}/launch`, on success shows toast and links to the created action's decision replay.
  - "Duplicate" button.

### Task 2.4: Tests

Minimum 4 test cases:
- Create returns `wft_*` id with `version=1, status='draft'`.
- Launch inserts an `action_records` row with `trigger = 'workflow:<id>'`.
- Launch with `model_strategy_id` stamps snapshot in `reasoning`.
- Duplicate preserves linked arrays but resets version to 1.

---

## Feature 3: Model Strategy Layer

### Task 3.1: Repository

**File:** `app/lib/repositories/model-strategies.repository.js`

Exports:
- `listModelStrategies(sql, orgId)` — ordered by `updated_at DESC`.
- `getModelStrategy(sql, orgId, strategyId)`
- `createModelStrategy(sql, orgId, { name, description, config })` — generates `mst_*` id, `config_json = JSON.stringify(config)`.
- `updateModelStrategy(sql, orgId, strategyId, patch)`
- `deleteModelStrategy(sql, orgId, strategyId)` — nullifies the FK soft-reference in `workflow_templates.model_strategy_id` (UPDATE SET NULL WHERE matches).

**Validation helper** (in the repository, not a separate file):
```js
function validateStrategyConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('config required');
  if (!config.primary?.provider || !config.primary?.model) {
    throw new Error('config.primary.provider and config.primary.model are required');
  }
  const costSens = ['low', 'balanced', 'high-quality'];
  if (config.costSensitivity && !costSens.includes(config.costSensitivity)) {
    throw new Error(`costSensitivity must be one of ${costSens.join(', ')}`);
  }
  // maxBudgetUsd optional number, maxRetries optional integer
  return true;
}
```

### Task 3.2: Routes

- `app/api/model-strategies/route.js` — GET (list), POST (create).
- `app/api/model-strategies/[strategyId]/route.js` — GET, PATCH, DELETE.

Return JSON-parsed `config` in responses so UI doesn't have to double-parse.

### Task 3.3: UI

- `app/model-strategies/page.js` — list with primary model badge and budget summary.
- `app/model-strategies/[strategyId]/page.js` — form covering the config shape from the spec (primary provider/model, fallback list, taskModes object, costSensitivity enum, latencySensitivity enum, maxBudgetUsd number input, maxRetries, allowed/disallowed provider chips).

### Task 3.4: Tests

- Create with valid config returns `mst_*` id.
- Create without `primary.provider` throws validation error.
- Update with partial config merges correctly (doesn't overwrite unrelated fields).

### Task 3.5: Link from Feature 2

In Feature 2 routes, when `model_strategy_id` is included in create/update payload, validate it exists in `model_strategies` (org-scoped) before persisting. Add to the workflow template launch flow: fetch strategy + snapshot into `reasoning`.

---

## Feature 4: Knowledge Collections

### Task 4.1: Repository

**File:** `app/lib/repositories/knowledge.repository.js`

Exports:
- `listCollections(sql, orgId, { sourceType, limit, offset })`
- `getCollection(sql, orgId, collectionId)`
- `createCollection(sql, orgId, { name, description, sourceType, tags })` — id `kc_*`, `tags_json`, `ingestion_status='empty'`, `doc_count=0`.
- `updateCollection(sql, orgId, collectionId, patch)`
- `listCollectionItems(sql, orgId, collectionId, { limit, offset })`
- `addCollectionItem(sql, orgId, collectionId, { source_uri, title, mime_type, metadata })` — id `kci_*`, status `'pending'`. Triggers `doc_count` increment on the parent collection (single UPDATE).

**No ingestion, no embedding, no retrieval.** Metadata layer only. `ingestion_status` stays `'empty'` or `'pending'` until Phase 2.

### Task 4.2: Routes

- `app/api/knowledge/collections/route.js` — GET, POST.
- `app/api/knowledge/collections/[collectionId]/route.js` — GET, PATCH.
- `app/api/knowledge/collections/[collectionId]/items/route.js` — GET, POST.

### Task 4.3: UI

- `app/knowledge/page.js` — list with doc count, source type badge, last synced timestamp.
- `app/knowledge/[collectionId]/page.js` — detail with items table (source_uri, title, mime, status) and "Add item" form.

### Task 4.4: Tests

- Create collection returns `kc_*` id with `doc_count=0`.
- `addCollectionItem` increments `doc_count`.
- List filters by `sourceType`.

### Task 4.5: Bind to workflow templates

Workflow template create/update already accepts `linked_knowledge_collection_ids_json` (see Feature 2 schema). In the workflow detail page, render the linked collections by fetching them from `/api/knowledge/collections?ids=<csv>`. Small UI addition — no schema change needed.

---

## Feature 5: Capability Registry

### Task 5.1: Repository

**File:** `app/lib/repositories/capabilities.repository.js`

Exports:
- `listCapabilities(sql, orgId, { category, risk_level, search, limit, offset })` — `search` does `WHERE (name ILIKE $ OR description ILIKE $ OR tags_json ILIKE $)`.
- `getCapability(sql, orgId, capabilityId)`
- `createCapability(sql, orgId, data)` — id `cap_*`.
- `updateCapability(sql, orgId, capabilityId, patch)`

### Task 5.2: Routes

- `app/api/capabilities/route.js` — GET (with search/filter), POST.
- `app/api/capabilities/[capabilityId]/route.js` — GET, PATCH.

### Task 5.3: UI

- `app/capabilities/page.js` — searchable grid with:
  - Search input (debounced, drives `?search=` query param).
  - Filter chips for category, risk level, `requires_approval`.
  - Each card shows: name, category, risk level badge, approval-required badge, health dot, pricing-present badge.
  - Clicking a card opens a detail drawer with invocation schema and docs link.

### Task 5.4: Tests

- Create capability with unique `(org_id, slug)` succeeds; duplicate slug fails gracefully (409).
- Search matches name substring.
- Filter by `risk_level` returns only matching rows.

### Task 5.5: Bind to workflow templates

Workflow template create/update already accepts `linked_capability_ids_json` and `linked_capability_tags_json`. In Feature 2 detail page, render linked capabilities by fetching them.

---

## Final Integration

### Task F1: Sidebar navigation

**File:** `app/components/Sidebar.js:16-60`

- [ ] Add a new `Studio` group after `Measure`:

```js
{
  label: 'Studio',
  items: [
    { href: '/workflows', icon: Workflow, label: 'Workflows' },
    { href: '/model-strategies', icon: Cpu, label: 'Model Strategies' },
    { href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
    { href: '/capabilities', icon: Wrench, label: 'Capabilities' },
  ],
},
```

Add to imports:
```js
import { Workflow, Cpu, BookOpen, Wrench, ... } from 'lucide-react';
```

### Task F2: Run all checks

- [ ] `npm run lint` — no errors
- [ ] `npm run governance:boundary:check` — passes
- [ ] `npm run test -- --run` — all green
- [ ] `npm run openapi:check` — passes or regenerate if route additions triggered drift (`npm run openapi:generate`, commit the new JSON)
- [ ] `npm run api:inventory:check` — passes or regenerate (`npm run api:inventory:generate`)

### Task F3: Commit and push to main

Per user memory (no PRs):
```bash
git push origin main
```

---

## Definition of Done

- [ ] Preflight P1 + P2 complete (boundary updated, DDL appended)
- [ ] Feature 1: graph route returns 200 for a real action id, tab renders in UI, blocked/invalidated nodes visibly distinct
- [ ] Feature 2: operator can create, view, duplicate, and launch a workflow template; launch creates a traceable action record
- [ ] Feature 3: strategies created via UI; workflow templates can link one; launch snapshots config into action reasoning
- [ ] Feature 4: collections created via UI; items added; workflow templates can link them
- [ ] Feature 5: capabilities searchable in registry; workflow templates can reference them
- [ ] All CI checks green
- [ ] Nav updated
- [ ] Committed + pushed to main

---

## Out of Scope (Phase 2)

Do not implement in this pass (per spec § Non-Goals + Phase 2):

- Drag/drop workflow authoring
- Step-level runtime orchestration / execution state machine
- Vector embedding / retrieval / ingestion jobs
- Provider execution proxy / runtime model routing
- x402 / payment settlement
- SDK method additions (would trigger 7-file doc update cascade — defer until Phase 2)

## Deferred Decisions

- **SDK surface:** This plan deliberately avoids adding SDK methods. Operators interact with these features via the web UI and raw API only in Phase 1. If/when SDK methods are added, the 7-file doc checklist in `MEMORY.md` must be followed.
- **OpenAPI drift:** New routes will cause `openapi:check` to fail until regenerated. Plan to run `npm run openapi:generate` and commit the output as part of Task F2.
- **API inventory drift:** Same — regen with `npm run api:inventory:generate`.

## Risk Notes

- **Schema column additions to `action_records`:** The spec suggests adding `model_strategy_id` and `model_strategy_snapshot` to actions. This plan instead stores the snapshot in the existing `reasoning` field as `WORKFLOW_LAUNCH_META=<json>` to avoid touching a heavily-exercised table. If Phase 2 demands structured querying of the strategy snapshot, add the columns then.
- **`auto-migrate.mjs` swallows DDL errors by design.** New tables must pass on first execution; if they silently fail on deploy, the feature won't work in prod. Test P2 locally before shipping.
- **Governance boundary is load-bearing.** If any new route lands outside the 4 new allowlisted prefixes, CI will block merge. Route paths are exact.
