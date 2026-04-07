# Design Spec: Tier Enforcement, Cost Tracking & Stripe Billing

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Make DashClaw's usage metering enforce real plan limits, add cost aggregation, and integrate Stripe for self-serve subscriptions.

---

## 1. Overview

DashClaw has metering infrastructure (usage_meters table, incrementMeter, estimateCost) but no enforcement — quotas always return `allowed: true`. This spec adds real tier-based quota enforcement, a cost aggregation API, Stripe Checkout/Portal integration, and monthly meter resets.

**Goal:** Orgs have real plans (free/pro/business/enterprise) with enforced limits. Self-serve upgrade via Stripe Checkout. Cost tracking visible via API. Monthly meter reset via cron.

---

## 2. Architecture

```
Governed action (guard / capability invoke / workflow execute)
    |
    v
Quota check (checkQuota in usage.js)
    |-- Load org.plan -> PLAN_LIMITS
    |-- Load current meters -> compare
    |-- < 80%: allow
    |-- 80-100%: allow + quota_warning
    |-- 100-110%: allow (grace) + notification
    |-- > 110%: block with 402
    |
    v
Meter increment (incrementMeter - fire and forget)
    |
    v
Cost tracking (estimateCost on actions with tokens)
    |-- Aggregate via GET /api/usage/costs

Upgrade flow:
    POST /api/billing/checkout -> Stripe Checkout -> redirect
    Stripe webhook -> update org.plan
    GET /api/billing/portal -> Stripe Customer Portal

Monthly reset:
    GET /api/cron/reset-meters (1st of month, Vercel Cron)
```

**Key decisions:**
- Plan limits defined as a constant (`PLAN_LIMITS`) — not in the database
- Existing `checkQuota()` in `usage.js` gets real enforcement (currently mocked)
- Soft block with 10% grace buffer — agents don't break immediately at 100%
- Stripe Checkout + Customer Portal only — DashClaw never touches credit cards
- No database schema changes — existing tables cover everything
- Stripe already in package.json

---

## 3. Plan Tiers & Limits

```javascript
const PLAN_LIMITS = {
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
```

**Pricing:**
- Free: $0/mo
- Pro: $49/mo
- Business: $249/mo
- Enterprise: Custom (contact sales)

Based on market research of AgentOps ($40/mo), Langfuse ($29/mo), Portkey ($49/mo), Helicone ($79/mo), Braintrust ($249/mo). DashClaw's Pro at $49 matches the median entry point. Business at $249 fills the gap between $79 and $2,499 that no competitor addresses with compliance features.

---

## 4. Quota Enforcement

**Modified `checkQuota()` in `usage.js`:**

### Input
```javascript
checkQuota(sql, orgId, resource)
// resource: "governed_actions" | "capability_invocations" | "workflow_executions" | "agents" | "api_keys" | "knowledge_collections"
```

### Logic
1. Load org.plan from database (default: "free")
2. Get limit from `PLAN_LIMITS[plan][resource]`
3. If limit is `Infinity`, return `{ allowed: true }`
4. Get current meter count for resource in `current` period
5. Calculate `percentage = (count / limit) * 100`
6. Return based on percentage:

| Percentage | Result |
|-----------|--------|
| < 80% | `{ allowed: true, warning: null }` |
| 80-100% | `{ allowed: true, warning: { level: "approaching", percentage, usage: count, limit } }` |
| 100-110% | `{ allowed: true, warning: { level: "grace", percentage, usage: count, limit } }` |
| > 110% | `{ allowed: false, code: "quota_exceeded", usage: count, limit }` |

### Where Quota Is Checked

| Route | Resource Checked |
|-------|-----------------|
| `POST /api/actions` (existing) | `governed_actions` — already calls checkQuota, currently mocked |
| `POST /api/capabilities/:id/invoke` | `capability_invocations` — add quota check |
| `POST /api/workflows/templates/:id/execute` | `workflow_executions` — add quota check |
| `POST /api/pairings` | `agents` — add quota check |

### Quota Warning in Response

When `warning` is non-null, append to the JSON response:

```json
{
  "quota_warning": {
    "resource": "governed_actions",
    "usage": 4200,
    "limit": 5000,
    "percentage": 84,
    "level": "approaching",
    "message": "Approaching quota limit (84%). Upgrade at /billing."
  }
}
```

### Quota Exceeded Response (402)

```json
{
  "error": "quota_exceeded",
  "code": "QUOTA_EXCEEDED",
  "resource": "governed_actions",
  "usage": 5600,
  "limit": 5000,
  "message": "Monthly governed actions limit exceeded. Upgrade your plan to continue.",
  "upgrade_url": "/billing"
}
```

---

## 5. Stripe Integration

### 5.1 `POST /api/billing/checkout`

Creates a Stripe Checkout Session for subscription.

**Request:**
```json
{ "plan": "pro" }
```

**Response:**
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_live_..." }
```

**Logic:**
1. Validate `plan` is "pro" or "business" (free has no checkout, enterprise is contact-us)
2. Map plan to Stripe Price ID: `STRIPE_PRICE_PRO` or `STRIPE_PRICE_BUSINESS` env var
3. Load or create Stripe customer for the org (using `stripe_customer_id` on org record, or create new)
4. Create Checkout Session with `mode: "subscription"`, `success_url`, `cancel_url`
5. Return session URL

### 5.2 `GET /api/billing/portal`

Creates a Stripe Customer Portal session for managing existing subscription.

**Response:**
```json
{ "url": "https://billing.stripe.com/p/session/..." }
```

**Logic:**
1. Load org's `stripe_customer_id`
2. If none, return 400 ("No billing account. Subscribe first.")
3. Create portal session with `return_url`
4. Return session URL

### 5.3 `POST /api/webhooks/stripe`

Receives and verifies Stripe webhook events.

**Events handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set `org.plan` to purchased tier, store `stripe_customer_id`, `stripe_subscription_id`, set `subscription_status` to "active" |
| `customer.subscription.updated` | Update `org.plan` if price changed (map Price ID back to tier), update `subscription_status` |
| `customer.subscription.deleted` | Reset `org.plan` to "free", set `subscription_status` to "canceled", clear `stripe_subscription_id` |
| `invoice.payment_failed` | Set `subscription_status` to "past_due" |

**Security:** Raw body parsed with `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`. Invalid signatures return 400.

**Price ID to plan mapping:** Reverse lookup from env vars. If `event.data.object.items[0].price.id === process.env.STRIPE_PRICE_PRO`, plan is "pro".

### 5.4 Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
NEXT_PUBLIC_APP_URL=https://your-dashclaw.vercel.app
```

All optional — if `STRIPE_SECRET_KEY` is not set, billing routes return 501 ("Billing not configured"). Quota enforcement still works (defaults to free plan limits).

---

## 6. Cost Aggregation

### `GET /api/usage/costs`

Returns cost breakdown for the current billing period.

**Query params:** `period` (optional, default: current month, format: `YYYY-MM`)

**Response:**
```json
{
  "period": "2026-04",
  "total_cost_usd": 12.45,
  "total_actions": 3200,
  "breakdown": {
    "capability_invoke": { "count": 230, "cost_usd": 1.15 },
    "workflow_execute": { "count": 45, "cost_usd": 8.10 },
    "workflow_step:prompt": { "count": 135, "cost_usd": 3.20 }
  },
  "daily": [
    { "date": "2026-04-01", "cost_usd": 0.45, "actions": 120 },
    { "date": "2026-04-02", "cost_usd": 0.62, "actions": 155 }
  ]
}
```

**Query:** Aggregates from `action_records` where `org_id` matches and `timestamp_start` falls within the requested period. Groups by `action_type` for breakdown, by date for daily.

---

## 7. Monthly Meter Reset

### `GET /api/cron/reset-meters`

Called by Vercel Cron on the 1st of each month at midnight UTC.

**Logic:**
1. Verify cron authorization (existing DashClaw cron auth pattern)
2. For each org with `current` period meters:
   a. Copy all `current` meter rows to `YYYY-MM` period (archive)
   b. Reset `current` meter counts to 0
3. Return summary: `{ orgs_processed, meters_reset }`

**Vercel cron config** — add to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/reset-meters", "schedule": "0 0 1 * *" }
  ]
}
```

Uses existing cron route pattern (DashClaw already has `/api/cron/signals` and `/api/cron/integration-health`).

---

## 8. Meter Increment Points

Meters that need to be incremented (some already exist, some are new):

| Route | Meter | Status |
|-------|-------|--------|
| `POST /api/actions` | `governed_actions` | **Already exists** (incrementMeter call in actions/route.js) |
| `POST /api/capabilities/:id/invoke` | `capability_invocations` | **Add** |
| `POST /api/capabilities/:id/invoke` | `governed_actions` | **Add** (capability invoke is also a governed action) |
| `POST /api/workflows/templates/:id/execute` | `workflow_executions` | **Add** |
| `POST /api/workflows/templates/:id/execute` | `governed_actions` | **Add** (workflow execute is also a governed action) |
| `POST /api/pairings` | `agents` | **Check if exists, add if not** |

All meter increments are fire-and-forget (existing pattern — `void incrementMeter(...)`).

---

## 9. Files Changed

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/usage.js` | **Modify** | `PLAN_LIMITS` constant, real `checkQuota()` with grace buffer |
| `app/api/billing/checkout/route.js` | **Create** | Stripe Checkout Session |
| `app/api/billing/portal/route.js` | **Create** | Stripe Customer Portal link |
| `app/api/webhooks/stripe/route.js` | **Create** | Stripe webhook handler (4 events) |
| `app/api/usage/costs/route.js` | **Create** | Cost aggregation by type and day |
| `app/api/cron/reset-meters/route.js` | **Create** | Monthly meter archive + reset |
| `app/api/capabilities/[capabilityId]/invoke/route.js` | **Modify** | Add quota check + meter increment |
| `app/api/workflows/templates/[templateId]/execute/route.js` | **Modify** | Add quota check + meter increment |
| `vercel.json` | **Modify** | Add cron schedule |
| `__tests__/unit/usage-quota.test.js` | **Create** | Tests for quota enforcement |

**No database schema changes.** Existing tables cover everything.

**Estimated scope:** ~450 lines of new/modified code across 10 files.

---

## 10. Success Criteria

- [ ] `checkQuota()` enforces real plan limits (not mocked)
- [ ] Free plan orgs blocked at 110% of governed_actions (5,500)
- [ ] Quota warnings returned at 80% and 100% in API responses
- [ ] 402 response with upgrade_url when quota exceeded
- [ ] `POST /api/billing/checkout` creates Stripe Checkout Session for pro/business
- [ ] `GET /api/billing/portal` returns Stripe Customer Portal URL
- [ ] Stripe webhook updates org.plan on subscription lifecycle events
- [ ] Webhook signature verified with STRIPE_WEBHOOK_SECRET
- [ ] `GET /api/usage/costs` returns cost breakdown by action type and day
- [ ] Capability invoke and workflow execute routes increment meters
- [ ] Monthly meter reset cron archives and zeros counters
- [ ] Billing routes return 501 when STRIPE_SECRET_KEY not configured
- [ ] All enforcement works without Stripe (manual plan assignment via DB)
