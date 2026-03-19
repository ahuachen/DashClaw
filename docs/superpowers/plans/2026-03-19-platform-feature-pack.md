# Platform Feature Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 features — approval webhooks, policy template gallery, cost dashboard, and message trail in Decision Replay — with zero-migration fresh install support.

**Architecture:** Each feature builds on existing infrastructure (webhook delivery, policy import, cost columns, message tables). Schema changes go into `0000_clammy_falcon.sql` with IF NOT EXISTS guards. All new API routes follow the existing pattern: `export const dynamic = 'force-dynamic'`, `getSql()`, `getOrgId()`, `NextResponse.json()`.

**Tech Stack:** Next.js 15, Vitest, postgres.js (tagged template SQL), Drizzle ORM schema, React with Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-19-platform-feature-pack-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `app/api/actions/costs/route.js` | Cost aggregation endpoint (GET) |
| `app/api/actions/[actionId]/messages/route.js` | Message trail endpoint for replay (GET) |
| `app/api/policies/templates/route.js` | Template gallery endpoint (GET) |
| `app/lib/policyPackPreviews.js` | Shared pack preview metadata (extracted from UI) |
| `app/components/AgentSpendCard.js` | Cost widget for Mission Control |
| `app/components/CommunicationTrail.js` | Message trail component for Replay |
| `__tests__/unit/webhooks.approval.test.js` | Tests for approval webhook wiring |
| `__tests__/unit/costs.route.test.js` | Tests for cost aggregation endpoint |
| `__tests__/unit/templates.route.test.js` | Tests for template gallery endpoint |
| `__tests__/unit/action-messages.route.test.js` | Tests for message trail endpoint |

### Modified Files
| File | Change |
|------|--------|
| `drizzle/0000_clammy_falcon.sql` | Add webhook_deliveries table, action_id on agent_messages, index |
| `schema/schema.js` | Add webhookDeliveries table, actionId on agentMessages |
| `app/api/webhooks/route.js` | Rename VALID_SIGNAL_TYPES to VALID_EVENT_TYPES, add approval events |
| `app/lib/webhooks.js` | Add fireWebhooksForApproval() |
| `app/api/actions/route.js` | Fire webhook on pending_approval |
| `app/api/approvals/[actionId]/route.js` | Fire webhook on approve/deny |
| `app/api/policies/import/route.js` | Add ?preview=true dry-run mode |
| `app/policies/page.js` | Add template gallery UI, extract PACK_PREVIEWS to shared module |
| `app/lib/repositories/actions.repository.js` | Add getCostAggregation() query |
| `app/mission-control/page.js` | Add AgentSpendCard widget |
| `app/decisions/page.js` | Add cost/token columns |
| `app/replay/[actionId]/page.js` | Add cost line + CommunicationTrail component |
| `sdk/dashclaw.js` | Add actionId param to sendMessage() |
| `app/api/_archive/messages/route.js` | Move to app/api/messages/route.js |
| `app/api/_archive/messages/threads/route.js` | Move to app/api/messages/threads/route.js |
| `app/api/_archive/messages/attachments/route.js` | Move to app/api/messages/attachments/route.js |

---

## Task 1: Schema Migration (webhook_deliveries + action_id on agent_messages)

**Files:**
- Modify: `drizzle/0000_clammy_falcon.sql`
- Modify: `schema/schema.js`

This task is a dependency for Tasks 2 and 7. Must be done first.

- [ ] **Step 1: Add webhook_deliveries table to base migration**

Append to the end of `drizzle/0000_clammy_falcon.sql` (before the final comment, after the last statement):

```sql
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "webhook_id" text NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "event_type" text NOT NULL,
  "payload" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "response_status" integer,
  "response_body" text,
  "attempted_at" text DEFAULT now() NOT NULL,
  "duration_ms" integer
);
```

- [ ] **Step 2: Add action_id column to agent_messages in base migration**

Append after the webhook_deliveries block:

```sql
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "action_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_messages_action_id" ON "agent_messages" ("action_id");
```

- [ ] **Step 3: Add webhookDeliveries to Drizzle schema**

In `schema/schema.js`, add after the existing `webhooks` table definition:

```javascript
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull(),
  orgId: text('org_id').notNull().default('org_default'),
  eventType: text('event_type').notNull(),
  payload: text('payload'),
  status: text('status').notNull().default('pending'),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  attemptedAt: text('attempted_at').default(sql`now()`).notNull(),
  durationMs: integer('duration_ms'),
});
```

- [ ] **Step 4: Add actionId column to agentMessages in Drizzle schema**

In `schema/schema.js`, add to the `agentMessages` table definition (after the existing columns):

```javascript
  actionId: text('action_id'),
```

- [ ] **Step 5: Verify migration runs cleanly on fresh DB**

Run: `node scripts/auto-migrate.mjs`
Expected: No errors. Both new table and new column created (or skipped if already exists).

- [ ] **Step 6: Commit**

```bash
git add drizzle/0000_clammy_falcon.sql schema/schema.js
git commit -m "feat: add webhook_deliveries table and action_id on agent_messages"
```

---

## Task 2: Approval Webhooks

**Files:**
- Modify: `app/api/webhooks/route.js`
- Modify: `app/lib/webhooks.js`
- Modify: `app/api/actions/route.js`
- Modify: `app/api/approvals/[actionId]/route.js`
- Create: `__tests__/unit/webhooks.approval.test.js`

**Depends on:** Task 1 (webhook_deliveries table)

- [ ] **Step 1: Write failing test for fireWebhooksForApproval**

Create `__tests__/unit/webhooks.approval.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getSql
const mockSql = vi.fn();
mockSql.mockImplementation((strings, ...values) => {
  // Default: return empty array (no webhooks)
  return Promise.resolve([]);
});

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSql }));

describe('fireWebhooksForApproval', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should query webhooks subscribed to the event type', async () => {
    const { fireWebhooksForApproval } = await import('../../app/lib/webhooks.js');

    await fireWebhooksForApproval('org_default', 'approval_pending', {
      action_id: 'ar_test',
      agent_id: 'agent-1',
      action_type: 'deploy',
      declared_goal: 'Deploy v2',
      risk_score: 75,
      status: 'pending_approval',
    }, mockSql);

    // Should have queried for webhooks
    expect(mockSql).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/webhooks.approval.test.js`
Expected: FAIL — `fireWebhooksForApproval` is not exported.

- [ ] **Step 3: Rename VALID_SIGNAL_TYPES and add approval events**

In `app/api/webhooks/route.js`, replace:

```javascript
const VALID_SIGNAL_TYPES = [
  'all', 'autonomy_spike', 'high_impact_low_oversight', 'repeated_failures',
  'stale_loop', 'assumption_drift', 'stale_assumption', 'stale_running_action'
];
```

With:

```javascript
const VALID_EVENT_TYPES = [
  'all', 'autonomy_spike', 'high_impact_low_oversight', 'repeated_failures',
  'stale_loop', 'assumption_drift', 'stale_assumption', 'stale_running_action',
  'approval_pending', 'approval_granted', 'approval_denied'
];
```

Update all references from `VALID_SIGNAL_TYPES` to `VALID_EVENT_TYPES` in that file.

- [ ] **Step 4: Implement fireWebhooksForApproval in webhooks.js**

In `app/lib/webhooks.js`, add:

```javascript
export async function fireWebhooksForApproval(orgId, eventType, action, sql) {
  try {
    const webhooks = await sql`
      SELECT id, url, secret, events FROM webhooks
      WHERE org_id = ${orgId} AND active = 1
    `;

    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

    const payload = {
      event: eventType,
      org_id: orgId,
      timestamp: new Date().toISOString(),
      action: {
        action_id: action.action_id,
        agent_id: action.agent_id,
        action_type: action.action_type,
        declared_goal: action.declared_goal,
        risk_score: action.risk_score,
        status: action.status,
        matched_policies: action.matched_policies || [],
        reason: action.reason || '',
      },
      approval_url: `${baseUrl}/api/approvals/${action.action_id}`,
      replay_url: `${baseUrl}/replay/${action.action_id}`,
    };

    for (const wh of webhooks) {
      const events = JSON.parse(wh.events || '["all"]');
      if (!events.includes('all') && !events.includes(eventType)) continue;
      deliverWebhook({
        webhookId: wh.id,
        orgId,
        url: wh.url,
        secret: wh.secret,
        eventType,
        payload,
        sql,
      }).catch(err =>
        console.error(`[WEBHOOK] Delivery failed for ${wh.id}:`, err.message)
      );
    }
  } catch (err) {
    console.error('[WEBHOOK] fireWebhooksForApproval error:', err.message);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/webhooks.approval.test.js`
Expected: PASS

- [ ] **Step 6: Wire webhook trigger into actions route**

In `app/api/actions/route.js`, add import at top:

```javascript
import { fireWebhooksForApproval } from '../../lib/webhooks.js';
```

After the action is created with `pending_approval` status (near the existing `fireActionAlert` call), add:

```javascript
if (createdAction.status === 'pending_approval') {
  fireWebhooksForApproval(orgId, 'approval_pending', {
    ...createdAction,
    matched_policies: guardDecision?.matched_policies,
    reason: guardDecision?.reason,
  }, sql).catch(() => {});
}
```

- [ ] **Step 7: Wire webhook trigger into approvals route**

In `app/api/approvals/[actionId]/route.js`, add import:

```javascript
import { fireWebhooksForApproval } from '../../../lib/webhooks.js';
```

After the approval/denial is recorded (after `recordApproval` call), fetch the full action record and fire the webhook:

```javascript
// Fetch full action for webhook payload (getActionStatus only returns status + agent_id)
const [fullAction] = await sql`
  SELECT action_id, agent_id, action_type, declared_goal, risk_score
  FROM action_records WHERE action_id = ${actionId} AND org_id = ${orgId} LIMIT 1
`;
const approvalEvent = decision === 'allow' ? 'approval_granted' : 'approval_denied';
if (fullAction) {
  fireWebhooksForApproval(orgId, approvalEvent, {
    ...fullAction,
    status: decision === 'allow' ? 'running' : 'failed',
  }, sql).catch(() => {});
}
```

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions.

- [ ] **Step 9: Commit**

```bash
git add app/api/webhooks/route.js app/lib/webhooks.js app/api/actions/route.js app/api/approvals/\[actionId\]/route.js __tests__/unit/webhooks.approval.test.js
git commit -m "feat: wire approval events into webhook system"
```

---

## Task 3: Policy Template Gallery — Backend

**Files:**
- Create: `app/api/policies/templates/route.js`
- Create: `app/lib/policyPackPreviews.js`
- Modify: `app/api/policies/import/route.js`
- Create: `__tests__/unit/templates.route.test.js`

- [ ] **Step 1: Extract PACK_PREVIEWS to shared module**

Create `app/lib/policyPackPreviews.js`:

```javascript
export const PACK_PREVIEWS = {
  'enterprise-strict': {
    name: 'Enterprise Strict',
    description: 'Maximum security — all external actions blocked or gated, zero autonomous risk',
    recommended_for: 'Regulated industries, SOC 2, financial services',
  },
  'smb-safe': {
    name: 'SMB Safe',
    description: 'Balanced protection for small-to-medium teams — blocks destructive ops, gates external comms',
    recommended_for: 'Small-to-medium teams, general SaaS',
  },
  'startup-growth': {
    name: 'Startup Growth',
    description: 'Permissive with guardrails — gates customer-facing comms, allows internal messaging',
    recommended_for: 'Fast-moving teams, internal tooling',
  },
  'development': {
    name: 'Development',
    description: 'Minimal guardrails for dev environments — warns on destructive ops, blocks production access',
    recommended_for: 'Development and staging environments',
  },
};

export const AVAILABLE_PACKS = Object.keys(PACK_PREVIEWS);

// Shared policy type inference — used by both templates endpoint and import preview
export function inferPolicyType(policy) {
  const rule = policy.rule || {};
  if (rule.block === true) return 'block_action_type';
  if (rule.require === 'approval') return 'require_approval';
  if (rule.warn === true) return 'risk_threshold';
  if (rule.threshold !== undefined) return 'risk_threshold';
  if (rule.rate_limit) return 'rate_limit';
  return 'risk_threshold';
}

export function summarizeRules(policy) {
  const rule = policy.rule || {};
  const parts = [];
  if (rule.action_types) parts.push(`action_types: [${rule.action_types.join(', ')}]`);
  if (rule.threshold !== undefined) parts.push(`threshold: ${rule.threshold}`);
  if (rule.block) parts.push('block: true');
  if (rule.require) parts.push(`require: ${rule.require}`);
  if (rule.warn) parts.push('warn: true');
  return parts.join(', ') || 'custom';
}
```

- [ ] **Step 2: Write failing test for templates endpoint**

Create `__tests__/unit/templates.route.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../app/lib/db.js', () => ({ getSql: () => vi.fn() }));
vi.mock('../../app/lib/org.js', () => ({
  getOrgId: () => 'org_default',
  getOrgRole: () => 'admin',
}));

describe('GET /api/policies/templates', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return all template packs with metadata', async () => {
    const { GET } = await import('../../app/api/policies/templates/route.js');
    const request = new Request('http://localhost:3000/api/policies/templates');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.templates).toBeDefined();
    expect(data.templates.length).toBeGreaterThan(0);

    const first = data.templates[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('recommended_for');
    expect(first).toHaveProperty('policy_count');
    expect(first).toHaveProperty('policies');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/templates.route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement templates endpoint**

Create `app/api/policies/templates/route.js`:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PACK_PREVIEWS, AVAILABLE_PACKS, inferPolicyType, summarizeRules } from '../../../lib/policyPackPreviews.js';

export async function GET() {
  try {
    const templates = [];

    for (const packId of AVAILABLE_PACKS) {
      const preview = PACK_PREVIEWS[packId];
      if (!preview) continue;

      try {
        const packPath = join(process.cwd(), 'app', 'lib', 'guardrails', 'packs', packId, 'policies.yml');
        const yamlContent = await readFile(packPath, 'utf-8');
        const jsYaml = await import('js-yaml');
        const doc = jsYaml.load(yamlContent);
        const policies = (doc.policies || []).map(p => ({
          name: p.description || p.id,
          policy_type: inferPolicyType(p),
          rules_summary: summarizeRules(p),
        }));

        templates.push({
          id: packId,
          name: preview.name,
          description: preview.description,
          recommended_for: preview.recommended_for,
          policy_count: policies.length,
          policies,
        });
      } catch {
        // Skip packs with missing YAML files
      }
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[POLICIES/TEMPLATES] GET error:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/templates.route.test.js`
Expected: PASS

- [ ] **Step 6: Add preview mode to import endpoint**

In `app/api/policies/import/route.js`, add import for shared `inferPolicyType` at the top:

```javascript
import { inferPolicyType } from '../../../lib/policyPackPreviews.js';
```

Then replace the local `inferPolicyType` function with the imported one. Add preview logic after policies are parsed but before insertion. Near the top of the POST handler, after parsing policies:

```javascript
const preview = request.nextUrl?.searchParams?.get('preview') === 'true';

if (preview) {
  const previewPolicies = [];
  for (const policy of policies) {
    const name = policy.description || policy.id;
    const policyType = inferPolicyType(policy);
    const existing = await findPolicyByName(sql, orgId, name);
    previewPolicies.push({
      name,
      policy_type: policyType,
      rules: JSON.stringify(policy.rule || {}),
      conflict: existing.length > 0,
      conflict_reason: existing.length > 0 ? 'Policy with this name already exists' : undefined,
    });
  }
  return NextResponse.json({
    preview: true,
    would_create: previewPolicies.filter(p => !p.conflict).length,
    would_skip: previewPolicies.filter(p => p.conflict).length,
    policies: previewPolicies,
  });
}
```

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/policies/templates/route.js app/lib/policyPackPreviews.js app/api/policies/import/route.js __tests__/unit/templates.route.test.js
git commit -m "feat: add policy template gallery endpoint with preview mode"
```

---

## Task 4: Policy Template Gallery — Frontend

**Files:**
- Modify: `app/policies/page.js`

**Depends on:** Task 3 (template endpoint and shared module)

- [ ] **Step 1: Update policies page to import shared PACK_PREVIEWS**

In `app/policies/page.js`, replace the local `PACK_PREVIEWS` object with:

```javascript
import { PACK_PREVIEWS } from '../lib/policyPackPreviews.js';
```

Remove the old inline `PACK_PREVIEWS` definition.

- [ ] **Step 2: Add template gallery section**

Add a "Browse Templates" button near the top of the policies page (beside the "Create Policy" button). When clicked, it fetches `GET /api/policies/templates` and renders a modal or expandable section with:

```jsx
{templates.map(t => (
  <div key={t.id} className="border border-border rounded-lg p-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-semibold">{t.name}</h3>
        <p className="text-sm text-muted-foreground">{t.description}</p>
        <span className="text-xs text-muted-foreground">{t.recommended_for}</span>
      </div>
      {t.all_installed ? (
        <span className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-md">
          Already installed
        </span>
      ) : (
        <button
          onClick={() => installPack(t.id)}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm"
        >
          Install ({t.policy_count} policies)
        </button>
      )}
    </div>
    {expanded === t.id && (
      <ul className="mt-3 space-y-1">
        {t.policies.map((p, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {p.name} <span className="text-xs opacity-60">({p.policy_type})</span>
          </li>
        ))}
      </ul>
    )}
  </div>
))}
```

The `installPack` function calls `POST /api/policies/import?preview=true` first, shows a confirmation modal with the preview, then calls `POST /api/policies/import` with `{ pack: packId }` on confirm. To compute `all_installed`, call the preview endpoint for each pack on load — if `would_create === 0`, set `all_installed: true` on that template.

- [ ] **Step 3: Test manually in browser**

Run: `npm run dev`
Navigate to `/policies`, click "Browse Templates", verify packs display, install one, confirm policies appear.

- [ ] **Step 4: Commit**

```bash
git add app/policies/page.js
git commit -m "feat: add policy template gallery UI with install preview"
```

---

## Task 5: Cost Aggregation Endpoint

**Files:**
- Create: `app/api/actions/costs/route.js`
- Modify: `app/lib/repositories/actions.repository.js`
- Create: `__tests__/unit/costs.route.test.js`

- [ ] **Step 1: Write failing test**

Create `__tests__/unit/costs.route.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('../../app/lib/org.js', () => ({
  getOrgId: () => 'org_default',
  getOrgRole: () => 'admin',
}));

describe('getCostAggregation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should be exported from actions repository', async () => {
    const repo = await import('../../app/lib/repositories/actions.repository.js');
    expect(typeof repo.getCostAggregation).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/costs.route.test.js`
Expected: FAIL — `getCostAggregation` not exported.

- [ ] **Step 3: Add getCostAggregation to actions repository**

In `app/lib/repositories/actions.repository.js`, add:

```javascript
export async function getCostAggregation(sql, orgId, { period = '30d', agentId = null } = {}) {
  const days = parseInt(period) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const agentFilter = agentId ? sql` AND agent_id = ${agentId}` : sql``;

  const [totals] = await sql`
    SELECT
      COALESCE(SUM(cost_estimate), 0)::real as total_cost_usd,
      COALESCE(SUM(tokens_in), 0)::integer as total_tokens_in,
      COALESCE(SUM(tokens_out), 0)::integer as total_tokens_out
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= ${since}::timestamptz
      ${agentFilter}
  `;

  const byAgent = await sql`
    SELECT
      agent_id,
      COALESCE(SUM(cost_estimate), 0)::real as cost_usd,
      COUNT(*)::integer as action_count
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= ${since}::timestamptz
      ${agentFilter}
    GROUP BY agent_id
    ORDER BY cost_usd DESC
  `;

  const byDay = await sql`
    SELECT
      DATE(created_at::timestamptz) as date,
      COALESCE(SUM(cost_estimate), 0)::real as cost_usd,
      COUNT(*)::integer as action_count
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= ${since}::timestamptz
      ${agentFilter}
    GROUP BY DATE(created_at::timestamptz)
    ORDER BY date DESC
  `;

  return {
    total_cost_usd: totals.total_cost_usd,
    total_tokens_in: totals.total_tokens_in,
    total_tokens_out: totals.total_tokens_out,
    period,
    by_agent: byAgent,
    by_day: byDay,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/costs.route.test.js`
Expected: PASS

- [ ] **Step 5: Create the costs API route**

Create `app/api/actions/costs/route.js`:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getCostAggregation } from '../../../lib/repositories/actions.repository.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const period = request.nextUrl.searchParams.get('period') || '30d';
    const agentId = request.nextUrl.searchParams.get('agent_id') || null;

    const validPeriods = ['7d', '30d', '90d'];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: `Invalid period. Use: ${validPeriods.join(', ')}` }, { status: 400 });
    }

    const data = await getCostAggregation(sql, orgId, { period, agentId });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[ACTIONS/COSTS] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch cost data' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/actions/costs/route.js app/lib/repositories/actions.repository.js __tests__/unit/costs.route.test.js
git commit -m "feat: add cost aggregation endpoint with by-agent and by-day breakdowns"
```

---

## Task 6: Cost Dashboard — Frontend

**Files:**
- Create: `app/lib/formatCost.js`
- Create: `app/components/AgentSpendCard.js`
- Modify: `app/mission-control/page.js`
- Modify: `app/decisions/page.js`
- Modify: `app/replay/[actionId]/page.js`

- [ ] **Step 0: Extract shared formatCost utility**

Create `app/lib/formatCost.js` (the mission-control page already has a local `formatCost` — replace its usage with this shared version):

```javascript
export function formatCost(usd) {
  if (usd === 0 || usd == null) return '$0.00';
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(count) {
  if (!count) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}
```

- [ ] **Step 1: Create AgentSpendCard component**

Create `app/components/AgentSpendCard.js`:

```javascript
'use client';
import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCost } from '../lib/formatCost';

export default function AgentSpendCard({ agentId }) {
  const [current, setCurrent] = useState(null);
  const [previous, setPrevious] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ period: '30d' });
    if (agentId) params.set('agent_id', agentId);
    // Fetch current and previous period in parallel
    Promise.all([
      fetch(`/api/actions/costs?${params}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/actions/costs?${new URLSearchParams({ period: '30d', ...Object.fromEntries(params) })}`).then(r => r.ok ? r.json() : null),
    ]).then(([curr, prev]) => { setCurrent(curr); setPrevious(prev); }).catch(() => {});
  }, [agentId]);

  if (!current) return null;

  const topAgents = (current.by_agent || []).slice(0, 3);
  const byDay = (current.by_day || []).slice(0, 30).reverse();
  const maxDay = Math.max(...byDay.map(d => d.cost_usd), 0.01);

  // Trend: compare current total vs previous period total
  const prevTotal = previous?.total_cost_usd || 0;
  const trendPercent = prevTotal > 0
    ? Math.round(((current.total_cost_usd - prevTotal) / prevTotal) * 100)
    : current.total_cost_usd > 0 ? 100 : 0;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Agent Spend (30d)</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{formatCost(current.total_cost_usd)}</span>
        {trendPercent !== 0 && (
          <span className={`flex items-center text-xs ${trendPercent > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {trendPercent > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
            {Math.abs(trendPercent)}%
          </span>
        )}
      </div>
      {/* Sparkline */}
      {byDay.length > 1 && (
        <div className="flex items-end gap-px h-8 mt-2">
          {byDay.map((d, i) => (
            <div key={i} className="flex-1 bg-primary/20 rounded-sm" style={{ height: `${(d.cost_usd / maxDay) * 100}%`, minHeight: '2px' }} />
          ))}
        </div>
      )}
      {topAgents.length > 0 && (
        <div className="mt-3 space-y-1">
          {topAgents.map(a => (
            <div key={a.agent_id} className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[140px]">{a.agent_id}</span>
              <span>{formatCost(a.cost_usd)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add AgentSpendCard to Mission Control**

In `app/mission-control/page.js`, import and add the card to the existing grid of widgets:

```javascript
import AgentSpendCard from '../components/AgentSpendCard';
```

Add in the metrics grid (near the other Card components):

```jsx
<Card>
  <AgentSpendCard agentId={agentId} />
</Card>
```

- [ ] **Step 3: Add cost columns to decisions list**

In `app/decisions/page.js`, import the shared formatters:

```javascript
import { formatCost, formatTokens } from '../lib/formatCost';
```

Add cost and token display to each action row. In the table/list rendering, add after the existing columns:

```jsx
{action.cost_estimate > 0 && (
  <span className="text-xs text-muted-foreground">
    {formatCost(action.cost_estimate)}
    {(action.tokens_in > 0 || action.tokens_out > 0) && (
      <span className="ml-1 opacity-70">
        {formatTokens(action.tokens_in)} in / {formatTokens(action.tokens_out)} out
      </span>
    )}
  </span>
)}
```

- [ ] **Step 4: Add cost line to Decision Replay**

In `app/replay/[actionId]/page.js`, in the "Final Result" section, add after the duration display:

```jsx
{action.cost_estimate > 0 && (
  <span className="text-muted-foreground">
    {' | '}{formatCost(action.cost_estimate)}
    {(action.tokens_in > 0 || action.tokens_out > 0) && (
      <span className="ml-1">
        ({(action.tokens_in || 0).toLocaleString()} in / {(action.tokens_out || 0).toLocaleString()} out)
      </span>
    )}
  </span>
)}
```

- [ ] **Step 5: Test manually in browser**

Run: `npm run dev`
- Check Mission Control for the Agent Spend card
- Check decisions list for cost column
- Check a replay page for cost line

- [ ] **Step 6: Commit**

```bash
git add app/lib/formatCost.js app/components/AgentSpendCard.js app/mission-control/page.js app/decisions/page.js app/replay/\[actionId\]/page.js
git commit -m "feat: add cost dashboard widget, cost columns, and cost in replay"
```

---

## Task 7: Unarchive Messages API

**Files:**
- Move: `app/api/_archive/messages/route.js` -> `app/api/messages/route.js`
- Move: `app/api/_archive/messages/threads/route.js` -> `app/api/messages/threads/route.js`
- Move: `app/api/_archive/messages/attachments/route.js` -> `app/api/messages/attachments/route.js`

This fixes the existing SDK bug where `sendMessage()` POSTs to `/api/messages` which 404s.

- [ ] **Step 1: Move message routes out of archive**

```bash
mkdir -p app/api/messages/threads app/api/messages/attachments
cp app/api/_archive/messages/route.js app/api/messages/route.js
cp app/api/_archive/messages/threads/route.js app/api/messages/threads/route.js
cp app/api/_archive/messages/attachments/route.js app/api/messages/attachments/route.js
```

- [ ] **Step 2: Fix import paths in moved files**

The archive routes were 3 levels deep (`_archive/messages/route.js` → `../../../lib/`). The new location is 2 levels deep (`messages/route.js` → `../../lib/`). Update all imports in the moved files:

In `app/api/messages/route.js`, `app/api/messages/threads/route.js`, `app/api/messages/attachments/route.js`:
- Change `../../../lib/db.js` to `../../lib/db.js`
- Change `../../../lib/org.js` to `../../lib/org.js`
- Change `../../../lib/validate.js` to `../../lib/validate.js`
- Change any other `../../../lib/` imports to `../../lib/`

For `threads/route.js` and `attachments/route.js` (one level deeper), keep their `../../../lib/` imports if they were already at that depth, or adjust to `../../../lib/` as needed. Verify with `grep -r "from '.*lib/" app/api/messages/` after moving.

- [ ] **Step 3: Verify SDK can send messages**

Run: `npm run dev`
Test with curl:
```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $DASHCLAW_API_KEY" \
  -d '{"from_agent_id":"test","message_type":"info","body":"test message"}'
```
Expected: 201 with message object (not 404).

- [ ] **Step 4: Commit**

```bash
git add app/api/messages/
git commit -m "feat: unarchive messages API routes (fixes SDK sendMessage 404)"
```

---

## Task 8: Message Trail Endpoint

**Files:**
- Create: `app/api/actions/[actionId]/messages/route.js`
- Create: `__tests__/unit/action-messages.route.test.js`

**Depends on:** Task 1 (action_id column), Task 7 (unarchived messages)

- [ ] **Step 1: Write failing test**

Create `__tests__/unit/action-messages.route.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn();
vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('../../app/lib/org.js', () => ({
  getOrgId: () => 'org_default',
  getOrgRole: () => 'admin',
}));

describe('GET /api/actions/[actionId]/messages', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return explicit matches when action_id is set on messages', async () => {
    // Mock: return one explicitly tagged message
    mockSql.mockResolvedValueOnce([
      { id: 'msg_1', from_agent_id: 'agent-a', body: 'Do the thing', action_id: 'ar_test', created_at: '2026-03-19T10:00:00Z' }
    ]);
    // Mock: return action record for fallback context
    mockSql.mockResolvedValueOnce([
      { action_id: 'ar_test', agent_id: 'agent-b', timestamp_start: '2026-03-19T10:00:05Z' }
    ]);

    const { GET } = await import('../../app/api/actions/[actionId]/messages/route.js');

    const request = new Request('http://localhost:3000/api/actions/ar_test/messages');
    request.nextUrl = new URL('http://localhost:3000/api/actions/ar_test/messages');
    const response = await GET(request, { params: { actionId: 'ar_test' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages.length).toBe(1);
    expect(data.correlation).toBe('explicit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/action-messages.route.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the messages endpoint**

Create `app/api/actions/[actionId]/messages/route.js`:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';

const TIME_WINDOW_SECONDS = 60;

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    if (!actionId || (!actionId.startsWith('ar_') && !actionId.startsWith('act_'))) {
      return NextResponse.json({ error: 'Valid action_id required' }, { status: 400 });
    }

    // Try explicit matches first
    const explicit = await sql`
      SELECT id, from_agent_id, to_agent_id, message_type, subject, body,
             thread_id, urgent, created_at, action_id
      FROM agent_messages
      WHERE org_id = ${orgId} AND action_id = ${actionId}
      ORDER BY created_at ASC
    `;

    if (explicit.length > 0) {
      return NextResponse.json({
        messages: explicit.map(m => ({ ...m, match_type: 'explicit' })),
        correlation: 'explicit',
        total: explicit.length,
      });
    }

    // Fallback: time-window correlation
    const [action] = await sql`
      SELECT agent_id, timestamp_start, timestamp_end
      FROM action_records
      WHERE org_id = ${orgId} AND action_id = ${actionId}
      LIMIT 1
    `;

    if (!action) {
      return NextResponse.json({ messages: [], correlation: 'none', total: 0 });
    }

    const windowStart = `${action.timestamp_start}`;
    const windowEnd = action.timestamp_end || new Date().toISOString();

    const correlated = await sql`
      SELECT id, from_agent_id, to_agent_id, message_type, subject, body,
             thread_id, urgent, created_at, action_id
      FROM agent_messages
      WHERE org_id = ${orgId}
        AND (from_agent_id = ${action.agent_id} OR to_agent_id = ${action.agent_id})
        AND created_at::timestamptz >= (${windowStart}::timestamptz - interval '60 seconds')
        AND created_at::timestamptz <= (${windowEnd}::timestamptz + interval '60 seconds')
      ORDER BY created_at ASC
      LIMIT 50
    `;

    return NextResponse.json({
      messages: correlated.map(m => ({ ...m, match_type: 'time_window' })),
      correlation: correlated.length > 0 ? 'time_window' : 'none',
      total: correlated.length,
    });
  } catch (error) {
    console.error('[ACTIONS/MESSAGES] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/action-messages.route.test.js`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/api/actions/\[actionId\]/messages/route.js __tests__/unit/action-messages.route.test.js
git commit -m "feat: add message trail endpoint with explicit + time-window correlation"
```

---

## Task 9: SDK — Add actionId to sendMessage

**Files:**
- Modify: `sdk/dashclaw.js`

- [ ] **Step 1: Add actionId parameter**

In `sdk/dashclaw.js`, update the `sendMessage` method:

```javascript
async sendMessage({ to, type, subject, body, threadId, urgent, actionId }) {
  return this._request('/api/messages', 'POST', {
    from_agent_id: this.agentId,
    to_agent_id: to,
    message_type: type,
    subject,
    body,
    thread_id: threadId,
    urgent,
    action_id: actionId,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add sdk/dashclaw.js
git commit -m "feat: add actionId param to SDK sendMessage for message-action linking"
```

---

## Task 10: Communication Trail in Decision Replay — Frontend

**Files:**
- Create: `app/components/CommunicationTrail.js`
- Modify: `app/replay/[actionId]/page.js`

- [ ] **Step 1: Create CommunicationTrail component**

Create `app/components/CommunicationTrail.js`:

```javascript
'use client';
import { useState, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';

export default function CommunicationTrail({ actionId, actingAgentId }) {
  const [messages, setMessages] = useState([]);
  const [correlation, setCorrelation] = useState('none');
  const [threadName, setThreadName] = useState(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!actionId) return;
    fetch(`/api/actions/${actionId}/messages`)
      .then(r => r.ok ? r.json() : { messages: [] })
      .then(data => {
        setMessages(data.messages || []);
        setCorrelation(data.correlation || 'none');
        setExpanded((data.messages || []).length > 0);
        // If messages belong to a thread, fetch thread name
        const threadId = data.messages?.[0]?.thread_id;
        if (threadId) {
          fetch(`/api/messages/threads?id=${threadId}`)
            .then(r => r.ok ? r.json() : null)
            .then(t => { if (t?.thread?.name) setThreadName(t.thread.name); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [actionId]);

  if (messages.length === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 text-sm font-medium text-left hover:bg-muted/50"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <MessageSquare className="h-4 w-4" />
        Communication Trail ({messages.length})
        {correlation === 'time_window' && (
          <span className="text-xs text-muted-foreground ml-auto">inferred from timing</span>
        )}
      </button>
      {expanded && (
        <div className="p-3 pt-0 space-y-2">
          {threadName && (
            <div className="text-xs text-muted-foreground font-medium mb-2">
              Thread: {threadName}
            </div>
          )}
          {messages.map(msg => {
            const isActingAgent = msg.from_agent_id === actingAgentId;
            return (
              <div key={msg.id} className={`flex ${isActingAgent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isActingAgent ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground'
                }`}>
                  <div className="text-xs font-medium mb-1 opacity-70">{msg.from_agent_id}</div>
                  <div className="whitespace-pre-wrap">{msg.body}</div>
                  <div className="text-[10px] opacity-50 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString()}
                    {msg.match_type === 'time_window' && ' (inferred)'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add CommunicationTrail to Replay page**

In `app/replay/[actionId]/page.js`, import the component:

```javascript
import CommunicationTrail from '../../components/CommunicationTrail';
```

Add between the "Governance Decision" and "Final Result" sections:

```jsx
<CommunicationTrail actionId={action.action_id} actingAgentId={action.agent_id} />
```

- [ ] **Step 3: Test manually in browser**

Run: `npm run dev`
Navigate to a replay page. If the action has associated messages, the Communication Trail section should appear with chat bubbles. If no messages exist, the section is hidden.

- [ ] **Step 4: Commit**

```bash
git add app/components/CommunicationTrail.js app/replay/\[actionId\]/page.js
git commit -m "feat: add communication trail to Decision Replay"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Verify fresh migration**

Run: `node scripts/auto-migrate.mjs`
Expected: No errors. All tables and columns exist.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`
Verify:
1. Webhooks page: can create webhook with `approval_pending` event type
2. Policies page: "Browse Templates" shows 4 packs, install works
3. Mission Control: Agent Spend card renders
4. Decisions list: cost column visible on actions with cost data
5. Replay page: cost line visible, communication trail visible (if messages exist)

- [ ] **Step 6: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup for platform feature pack"
```
