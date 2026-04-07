# Billing, Metering & Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DashClaw enforce real plan limits (free/pro/business/enterprise), track costs, integrate Stripe for self-serve subscriptions, and reset meters monthly.

**Architecture:** Modify existing `usage.js` to enforce tier-based quotas with grace buffer. Add Stripe Checkout + Customer Portal routes (3 new routes). Add cost aggregation endpoint. Add monthly meter reset cron. Wire quota checks into capability invoke and workflow execute routes.

**Tech Stack:** Next.js 15, Stripe SDK (already installed v21.0.1), existing usage_meters table, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-billing-metering-design.md`

**Working directory:** `C:\Projects\DashClaw`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/usage.js` | Modify | PLAN_LIMITS, real checkQuota with grace buffer, getPlanLimits by tier |
| `app/api/billing/checkout/route.js` | Create | Stripe Checkout Session creation |
| `app/api/billing/portal/route.js` | Create | Stripe Customer Portal link |
| `app/api/webhooks/stripe/route.js` | Create | Stripe webhook handler |
| `app/api/usage/costs/route.js` | Create | Cost aggregation by type and day |
| `app/api/cron/reset-meters/route.js` | Create | Monthly meter archive + reset |
| `app/api/capabilities/[capabilityId]/invoke/route.js` | Modify | Add quota check + meter increment |
| `app/api/workflows/templates/[templateId]/execute/route.js` | Modify | Add quota check + meter increment |
| `vercel.json` | Modify | Add cron schedule |
| `__tests__/unit/usage-quota.test.js` | Create | Tests for quota enforcement |

---

## Task 1: Quota Enforcement in usage.js

**Files:**
- Modify: `app/lib/usage.js`
- Create: `__tests__/unit/usage-quota.test.js`

- [ ] **Step 1: Write tests for quota enforcement**

Create `__tests__/unit/usage-quota.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { PLAN_LIMITS, calculateQuotaStatus } from '../../app/lib/usage.js';

describe('PLAN_LIMITS', () => {
  it('defines four tiers', () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(['free', 'pro', 'business', 'enterprise']);
  });

  it('free tier has 5000 governed_actions', () => {
    expect(PLAN_LIMITS.free.governed_actions).toBe(5000);
  });

  it('enterprise tier has Infinity for all resources', () => {
    for (const value of Object.values(PLAN_LIMITS.enterprise)) {
      expect(value).toBe(Infinity);
    }
  });
});

describe('calculateQuotaStatus', () => {
  it('returns allowed with no warning under 80%', () => {
    const result = calculateQuotaStatus(3000, 5000);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });

  it('returns approaching warning at 80-100%', () => {
    const result = calculateQuotaStatus(4200, 5000);
    expect(result.allowed).toBe(true);
    expect(result.warning.level).toBe('approaching');
    expect(result.warning.percentage).toBe(84);
  });

  it('returns grace warning at 100-110%', () => {
    const result = calculateQuotaStatus(5200, 5000);
    expect(result.allowed).toBe(true);
    expect(result.warning.level).toBe('grace');
  });

  it('blocks at over 110%', () => {
    const result = calculateQuotaStatus(5600, 5000);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe('quota_exceeded');
  });

  it('always allows Infinity limits', () => {
    const result = calculateQuotaStatus(999999, Infinity);
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeNull();
  });

  it('returns correct usage and limit in warning', () => {
    const result = calculateQuotaStatus(4500, 5000);
    expect(result.warning.usage).toBe(4500);
    expect(result.warning.limit).toBe(5000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/usage-quota.test.js`
Expected: FAIL — PLAN_LIMITS and calculateQuotaStatus not exported

- [ ] **Step 3: Modify usage.js — add PLAN_LIMITS and calculateQuotaStatus**

In `app/lib/usage.js`, replace the `getPlanLimits` function (lines 23-30) with:

```javascript
export const PLAN_LIMITS = {
  free: {
    governed_actions: 5000,
    agents: 3,
    api_keys: 2,
    capability_invocations: 100,
    workflow_executions: 50,
    knowledge_collections: 3,
  },
  pro: {
    governed_actions: 50000,
    agents: 25,
    api_keys: 10,
    capability_invocations: 5000,
    workflow_executions: 2500,
    knowledge_collections: 25,
  },
  business: {
    governed_actions: 500000,
    agents: Infinity,
    api_keys: Infinity,
    capability_invocations: 50000,
    workflow_executions: 25000,
    knowledge_collections: Infinity,
  },
  enterprise: {
    governed_actions: Infinity,
    agents: Infinity,
    api_keys: Infinity,
    capability_invocations: Infinity,
    workflow_executions: Infinity,
    knowledge_collections: Infinity,
  },
};

export function getPlanLimits(plan = 'free') {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

export function calculateQuotaStatus(usage, limit) {
  if (limit === Infinity) {
    return { allowed: true, warning: null };
  }

  const percentage = Math.round((usage / limit) * 100);

  if (percentage < 80) {
    return { allowed: true, warning: null };
  }

  if (percentage <= 100) {
    return {
      allowed: true,
      warning: {
        level: 'approaching',
        percentage,
        usage,
        limit,
        message: `Approaching quota limit (${percentage}%). Upgrade at /billing.`,
      },
    };
  }

  if (percentage <= 110) {
    return {
      allowed: true,
      warning: {
        level: 'grace',
        percentage,
        usage,
        limit,
        message: `Quota limit exceeded (${percentage}%). Grace period active. Upgrade to continue.`,
      },
    };
  }

  return {
    allowed: false,
    code: 'quota_exceeded',
    usage,
    limit,
    percentage,
    message: 'Monthly quota exceeded. Upgrade your plan to continue.',
  };
}
```

- [ ] **Step 4: Modify checkQuotaFast to use real enforcement**

Replace the `checkQuotaFast` and `checkQuota` functions (lines 181-190) with:

```javascript
export async function checkQuotaFast(orgId, resource, plan, sql) {
  const limits = getPlanLimits(plan);
  const limit = limits[resource];

  if (limit === undefined || limit === Infinity) {
    return { allowed: true, warning: null, usage: 0, limit: Infinity, percent: 0 };
  }

  const period = (resource === 'agents' || resource === 'api_keys' || resource === 'knowledge_collections')
    ? 'current'
    : getCurrentPeriod();

  const rows = await sql`
    SELECT count FROM usage_meters
    WHERE org_id = ${orgId} AND period = ${period} AND resource = ${resource}
    LIMIT 1
  `;
  const usage = rows.length > 0 ? (rows[0].count || 0) : 0;

  return calculateQuotaStatus(usage, limit);
}

export async function checkQuota(orgId, resource, plan, sql) {
  return checkQuotaFast(orgId, resource, plan, sql);
}
```

- [ ] **Step 5: Run tests**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/usage-quota.test.js`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/usage.js __tests__/unit/usage-quota.test.js
git commit -m "feat(billing): enforce real plan limits with grace buffer

Four tiers: free/pro/business/enterprise. checkQuota now enforces
real limits. Grace buffer at 100-110%. Block at >110%. Warning
at 80-100%."
```

---

## Task 2: Stripe Checkout & Portal Routes

**Files:**
- Create: `app/api/billing/checkout/route.js`
- Create: `app/api/billing/portal/route.js`

- [ ] **Step 1: Create Stripe checkout route**

Create `app/api/billing/checkout/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';

const PLAN_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO,
  business: process.env.STRIPE_PRICE_BUSINESS,
};

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Billing not configured', code: 'BILLING_NOT_CONFIGURED' },
        { status: 501 },
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();
    const { plan } = body;

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "pro" or "business".', code: 'INVALID_PLAN' },
        { status: 400 },
      );
    }

    const priceId = PLAN_PRICES[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price not configured for ${plan} plan`, code: 'PRICE_NOT_CONFIGURED' },
        { status: 501 },
      );
    }

    // Load or create Stripe customer
    const orgs = await sql`SELECT stripe_customer_id FROM organizations WHERE id = ${orgId} LIMIT 1`;
    let customerId = orgs.length > 0 ? orgs[0].stripe_customer_id : null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { org_id: orgId },
      });
      customerId = customer.id;
      await sql`
        UPDATE organizations SET stripe_customer_id = ${customerId} WHERE id = ${orgId}
      `;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=canceled`,
      metadata: { org_id: orgId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return apiErrorResponse(error, 'BILLING_CHECKOUT');
  }
}
```

- [ ] **Step 2: Create Stripe portal route**

Create `app/api/billing/portal/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';

export async function GET(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Billing not configured', code: 'BILLING_NOT_CONFIGURED' },
        { status: 501 },
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sql = getSql();
    const orgId = getOrgId(request);

    const orgs = await sql`SELECT stripe_customer_id FROM organizations WHERE id = ${orgId} LIMIT 1`;
    const customerId = orgs.length > 0 ? orgs[0].stripe_customer_id : null;

    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account. Subscribe first.', code: 'NO_CUSTOMER' },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return apiErrorResponse(error, 'BILLING_PORTAL');
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/billing/checkout/route.js" "app/api/billing/portal/route.js"
git commit -m "feat(billing): add Stripe Checkout and Customer Portal routes

POST /api/billing/checkout creates subscription checkout session.
GET /api/billing/portal returns customer portal URL.
Returns 501 when Stripe not configured."
```

---

## Task 3: Stripe Webhook Handler

**Files:**
- Create: `app/api/webhooks/stripe/route.js`

- [ ] **Step 1: Create the webhook handler**

Create `app/api/webhooks/stripe/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getSql } from '../../../lib/db.js';

const PRICE_TO_PLAN = {};

function buildPriceToPlan() {
  if (process.env.STRIPE_PRICE_PRO) PRICE_TO_PLAN[process.env.STRIPE_PRICE_PRO] = 'pro';
  if (process.env.STRIPE_PRICE_BUSINESS) PRICE_TO_PLAN[process.env.STRIPE_PRICE_BUSINESS] = 'business';
}

export async function POST(request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    buildPriceToPlan();
    const sql = getSql();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.metadata?.org_id;
        const plan = session.metadata?.plan;
        if (!orgId || !plan) break;

        const customerId = session.customer;
        const subscriptionId = session.subscription;

        await sql`
          UPDATE organizations
          SET plan = ${plan},
              stripe_customer_id = ${customerId},
              stripe_subscription_id = ${subscriptionId},
              subscription_status = 'active'
          WHERE id = ${orgId}
        `;
        console.log(`[Stripe] Org ${orgId} upgraded to ${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId] || null;
        const status = subscription.status;

        const updates = { subscription_status: status };
        if (plan) updates.plan = plan;
        if (subscription.current_period_end) {
          updates.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
        }

        if (plan) {
          await sql`
            UPDATE organizations
            SET plan = ${plan},
                subscription_status = ${status},
                current_period_end = ${updates.current_period_end || null}
            WHERE stripe_customer_id = ${customerId}
          `;
        } else {
          await sql`
            UPDATE organizations
            SET subscription_status = ${status},
                current_period_end = ${updates.current_period_end || null}
            WHERE stripe_customer_id = ${customerId}
          `;
        }
        console.log(`[Stripe] Subscription updated for customer ${customerId}: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await sql`
          UPDATE organizations
          SET plan = 'free',
              subscription_status = 'canceled',
              stripe_subscription_id = NULL
          WHERE stripe_customer_id = ${customerId}
        `;
        console.log(`[Stripe] Subscription canceled for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        await sql`
          UPDATE organizations
          SET subscription_status = 'past_due'
          WHERE stripe_customer_id = ${customerId}
        `;
        console.warn(`[Stripe] Payment failed for customer ${customerId}`);
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/webhooks/stripe/route.js"
git commit -m "feat(billing): add Stripe webhook handler

Handles checkout.session.completed, customer.subscription.updated,
customer.subscription.deleted, invoice.payment_failed.
Updates org plan and subscription status. Signature verified."
```

---

## Task 4: Cost Aggregation Endpoint

**Files:**
- Create: `app/api/usage/costs/route.js`

- [ ] **Step 1: Create the costs endpoint**

Create `app/api/usage/costs/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';
import { getCurrentPeriod } from '../../../lib/usage.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || getCurrentPeriod();

    // Period format: YYYY-MM
    const periodStart = `${period}-01T00:00:00Z`;
    const [year, month] = period.split('-').map(Number);
    const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    const periodEnd = `${nextMonth}-01T00:00:00Z`;

    // Breakdown by action type
    const breakdown = await sql`
      SELECT
        action_type,
        COUNT(*)::int AS count,
        COALESCE(SUM(cost_estimate), 0)::real AS cost_usd
      FROM action_records
      WHERE org_id = ${orgId}
        AND timestamp_start >= ${periodStart}
        AND timestamp_start < ${periodEnd}
        AND cost_estimate > 0
      GROUP BY action_type
      ORDER BY cost_usd DESC
    `;

    // Daily totals
    const daily = await sql`
      SELECT
        DATE(timestamp_start) AS date,
        COUNT(*)::int AS actions,
        COALESCE(SUM(cost_estimate), 0)::real AS cost_usd
      FROM action_records
      WHERE org_id = ${orgId}
        AND timestamp_start >= ${periodStart}
        AND timestamp_start < ${periodEnd}
      GROUP BY DATE(timestamp_start)
      ORDER BY date
    `;

    // Totals
    const totals = await sql`
      SELECT
        COUNT(*)::int AS total_actions,
        COALESCE(SUM(cost_estimate), 0)::real AS total_cost_usd
      FROM action_records
      WHERE org_id = ${orgId}
        AND timestamp_start >= ${periodStart}
        AND timestamp_start < ${periodEnd}
    `;

    const breakdownMap = {};
    for (const row of breakdown) {
      breakdownMap[row.action_type] = {
        count: row.count,
        cost_usd: Math.round(row.cost_usd * 1000) / 1000,
      };
    }

    return NextResponse.json({
      period,
      total_cost_usd: Math.round((totals[0]?.total_cost_usd || 0) * 1000) / 1000,
      total_actions: totals[0]?.total_actions || 0,
      breakdown: breakdownMap,
      daily: daily.map((d) => ({
        date: d.date,
        actions: d.actions,
        cost_usd: Math.round(d.cost_usd * 1000) / 1000,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, 'USAGE_COSTS');
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/usage/costs/route.js"
git commit -m "feat(billing): add cost aggregation endpoint

GET /api/usage/costs returns cost breakdown by action type and daily
totals. Aggregates from action_records.cost_estimate."
```

---

## Task 5: Monthly Meter Reset Cron

**Files:**
- Create: `app/api/cron/reset-meters/route.js`
- Modify: `vercel.json`

- [ ] **Step 1: Create the reset-meters cron route**

Create `app/api/cron/reset-meters/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getCurrentPeriod } from '../../../lib/usage.js';

export async function GET(request) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const sql = getSql();
    const period = getCurrentPeriod();

    // Archive current monthly meters to YYYY-MM period
    const archived = await sql`
      INSERT INTO usage_meters (org_id, period, resource, count, updated_at)
      SELECT org_id, ${period}, resource, count, NOW()
      FROM usage_meters
      WHERE period = ${period}
        AND resource IN ('governed_actions', 'capability_invocations', 'workflow_executions')
      ON CONFLICT (org_id, period, resource)
      DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
    `;

    // Reset monthly counters (governed_actions, capability_invocations, workflow_executions)
    // by deleting current period rows — they'll be recreated at 0 by incrementMeter
    const reset = await sql`
      DELETE FROM usage_meters
      WHERE period = ${period}
        AND resource IN ('governed_actions', 'capability_invocations', 'workflow_executions')
    `;

    console.log(`[Cron] Meter reset for period ${period}: ${reset.count || 0} meters reset`);

    return NextResponse.json({
      success: true,
      period,
      meters_reset: reset.count || 0,
    });
  } catch (error) {
    console.error('[Cron] Meter reset failed:', error);
    return NextResponse.json({ error: 'Meter reset failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add cron to vercel.json**

Read `vercel.json` and add the crons field. The file currently has:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "node scripts/auto-migrate.mjs && next build"
}
```

Add the crons array:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "node scripts/auto-migrate.mjs && next build",
  "crons": [
    { "path": "/api/cron/reset-meters", "schedule": "0 0 1 * *" }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/cron/reset-meters/route.js" vercel.json
git commit -m "feat(billing): add monthly meter reset cron

Archives and resets governed_actions, capability_invocations,
workflow_executions counters on the 1st of each month.
Vercel Cron schedule added to vercel.json."
```

---

## Task 6: Wire Quota Checks into Existing Routes

**Files:**
- Modify: `app/api/capabilities/[capabilityId]/invoke/route.js`
- Modify: `app/api/workflows/templates/[templateId]/execute/route.js`

- [ ] **Step 1: Add quota check and meter to capability invoke**

In `app/api/capabilities/[capabilityId]/invoke/route.js`, add the import:

```javascript
import { checkQuotaFast, getOrgPlan, incrementMeter } from '../../../../lib/usage.js';
```

After the guard evaluation block and before the org settings resolution, add:

```javascript
    // Quota check
    const plan = await getOrgPlan(orgId, sql);
    const capQuota = await checkQuotaFast(orgId, 'capability_invocations', plan, sql);
    if (!capQuota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'quota_exceeded',
          code: 'QUOTA_EXCEEDED',
          resource: 'capability_invocations',
          usage: capQuota.usage,
          limit: capQuota.limit,
          message: 'Monthly capability invocation limit exceeded. Upgrade your plan to continue.',
          upgrade_url: '/billing',
        },
        { status: 402 },
      );
    }
```

After the successful response (before `return NextResponse.json`), add meter increment as fire-and-forget:

```javascript
    // Meter increment (fire-and-forget)
    void Promise.all([
      incrementMeter(orgId, 'capability_invocations', sql),
      incrementMeter(orgId, 'governed_actions', sql),
    ]).catch((err) => console.warn('[API] Meter increment failed:', err.message));
```

If `capQuota.warning` is non-null, include it in the success response:

```javascript
      quota_warning: capQuota.warning || undefined,
```

- [ ] **Step 2: Add quota check and meter to workflow execute**

In `app/api/workflows/templates/[templateId]/execute/route.js`, add the import:

```javascript
import { checkQuotaFast, getOrgPlan, incrementMeter } from '../../../../../lib/usage.js';
```

After the guard evaluation block and before model strategy resolution, add:

```javascript
    // Quota check
    const plan = await getOrgPlan(orgId, sql);
    const wfQuota = await checkQuotaFast(orgId, 'workflow_executions', plan, sql);
    if (!wfQuota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'quota_exceeded',
          code: 'QUOTA_EXCEEDED',
          resource: 'workflow_executions',
          usage: wfQuota.usage,
          limit: wfQuota.limit,
          message: 'Monthly workflow execution limit exceeded. Upgrade your plan to continue.',
          upgrade_url: '/billing',
        },
        { status: 402 },
      );
    }
```

After the successful response, add meter increment:

```javascript
    // Meter increment (fire-and-forget)
    void Promise.all([
      incrementMeter(orgId, 'workflow_executions', sql),
      incrementMeter(orgId, 'governed_actions', sql),
    ]).catch((err) => console.warn('[API] Meter increment failed:', err.message));
```

Include `quota_warning` in success response if present.

- [ ] **Step 3: Verify both routes still lint clean**

Run: `cd "C:\Projects\DashClaw" && npm run lint`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/capabilities/[capabilityId]/invoke/route.js" "app/api/workflows/templates/[templateId]/execute/route.js"
git commit -m "feat(billing): wire quota checks into capability invoke and workflow execute

402 on quota exceeded. Fire-and-forget meter increments for
capability_invocations, workflow_executions, and governed_actions.
Quota warnings included in success responses."
```

---

## Task 7: Integration Verification

- [ ] **Step 1: Run all new and existing tests**

Run: `cd "C:\Projects\DashClaw" && npx vitest run`
Expected: All tests pass (quota tests + existing)

- [ ] **Step 2: Run lint**

Run: `cd "C:\Projects\DashClaw" && npm run lint`
Expected: No new errors

- [ ] **Step 3: Verify commit history**

Run: `cd "C:\Projects\DashClaw" && git log --oneline -7`
Expected: 6 new commits (Tasks 1-6)

- [ ] **Step 4: Verify vercel.json has cron**

Run: `cd "C:\Projects\DashClaw" && cat vercel.json`
Expected: Contains `"crons"` array with reset-meters schedule

---

## Summary

| Task | What | Files | Commits |
|------|------|-------|---------|
| 1 | Quota enforcement + PLAN_LIMITS | 2 (modify + test) | 1 |
| 2 | Stripe Checkout + Portal | 2 | 1 |
| 3 | Stripe webhook handler | 1 | 1 |
| 4 | Cost aggregation endpoint | 1 | 1 |
| 5 | Monthly meter reset cron | 2 (create + modify) | 1 |
| 6 | Wire quotas into routes | 2 (modify) | 1 |
| 7 | Integration verification | 0 | 0 |
| **Total** | | **10 files** | **6 commits** |
