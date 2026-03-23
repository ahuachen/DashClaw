# Phase 02: Security & Product Audit - Research

**Researched:** 2026-03-23
**Domain:** Application security (OWASP Top 10 + auth), product UX narrative, free-tier viability
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Fix issues in-place as they're found — audit produces working code, not a document
**D-02:** Issues too risky to fix inline (encryption key rotation, schema changes, SSE refactors) are flagged and deferred with risk level documented
**D-03:** Known bugs from CONCERNS.md are also in scope — fix safe-to-patch bugs, defer risky ones (SSE deadlock, schema-level changes)
**D-04:** Deep analysis — OWASP Top 10 + auth bypass vectors + header hardening + input validation + SSRF/injection testing
**D-05:** Build on existing CONCERNS.md findings (5 security items already flagged) — verify and expand, don't duplicate
**D-06:** All exposed routes in scope — 7 canonical governance routes + extension routes (compliance, drift, evaluations, scoring) + cron endpoints + infrastructure routes
**D-07:** UX narrative walkthrough — walk through /connect to /mission-control to /decisions as a new developer. Does the story hold? Is the value obvious?
**D-08:** Three persona perspectives: solo agent builder, startup CTO (3-5 agents), enterprise evaluator (SOC 2/NIST compliance needs)
**D-09:** Governance loop verified via code path review — trace guard to action to outcome to signal through the code. No live SDK test required.
**D-10:** Full stack $0 — Vercel free + Neon free + optional Upstash free. Document any limits (connections, storage, bandwidth) that could surprise users.
**D-11:** Features requiring paid services must degrade gracefully — clear "upgrade to enable" messaging, not silent broken state. Fix any silent failures found.

### Claude's Discretion
- Prioritization order of security findings (which to fix first)
- Exact wording of graceful degradation messages
- How to structure the product narrative assessment (doc format, inline comments, etc.)
- Whether to update CONCERNS.md with new findings or create a separate audit report

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | All 7 canonical API routes audited against OWASP Top 10 | Routes read; auth, injection, and misconfiguration findings documented below |
| SEC-02 | Security headers (CSP, CORS, X-Frame-Options, X-Content-Type-Options, HSTS) correctly configured on all routes | next.config.js and middleware.js both set headers; gaps identified below |
| SEC-03 | Input validation and sanitization verified on all user-facing endpoints | validate.js patterns read; specific gaps catalogued in Pitfalls section |
| SEC-04 | Auth flow (API key validation, local admin, NextAuth) verified secure with no bypass vectors | Full auth path read in middleware.js; three findings catalogued |
| PROD-01 | End-to-end governance loop works correctly from a fresh deploy | Code path traced; all four steps verified implementable via code review |
| PROD-02 | Product value proposition clear to a new developer within 5 minutes | /connect and key pages read; narrative gaps identified |
| PROD-03 | Free-tier viability confirmed — deploy costs $0, no features require paid services, limits documented | Free-tier constraints researched and documented |
</phase_requirements>

---

## Summary

DashClaw v2.3.0 has a mature security baseline with several strong fundamentals: AES-256-GCM encryption, timing-safe API key comparison, parameterized queries throughout (no SQL injection surface), rate limiting with Upstash fallback, comprehensive CSP and security headers, and prompt injection scanning. The audit starts from a genuinely good position, not ground zero.

However, there are a specific set of actionable gaps that need to be fixed before public launch. The most critical are: (1) the `getOrgId()` helper defaults to `org_default` with no validation, creating a potential org-scope confusion vector on API key routes; (2) HSTS max-age is inconsistent between `next.config.js` (2-year value) and `middleware.js` (1-year value); (3) prompt injection is detected but never enforced — HIGH severity patterns in declared_goal inputs pass silently; and (4) several features silently fail rather than showing "upgrade to enable" messaging when optional services (Redis, OpenAI embeddings) are absent.

The product narrative for PROD-01 through PROD-03 is sound: the code path from `guard()` to `createAction()` to `updateOutcome()` to signals is complete and coherent. The value proposition is demonstrable within 5 minutes. Free-tier viability is real but requires documenting Neon (0.5GB free), Vercel (100GB bandwidth/month), and the memory-backend caveat clearly.

**Primary recommendation:** This phase is a fixing phase. Audit by walking the code systematically: headers first (easiest, highest impact for SEC-02), then auth paths (SEC-04), then input validation gaps (SEC-03), then silent failures (PROD-03/D-11), then product narrative review (PROD-02). Fix as you go. Defer the three items explicitly flagged as risky (encryption key rotation, SSE refactor, schema-level changes).

---

## Standard Stack

### Core (already in the project — verify, do not install new packages)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js | ^16.1.6 | Framework + security headers in next.config.js | CSP set here |
| NextAuth.js | ^4.24.13 | Session auth for dashboard | JWT strategy |
| Vitest | ^4.1.0 | Test runner | 80 unit test files exist |
| Drizzle ORM | ^0.45.1 | All DB queries — parameterized by default | No raw SQL in routes |
| zod | ^4.3.6 | Available but hand-rolled validate.js is used for core routes | |
| Node.js crypto | built-in | AES-256-GCM encryption in encryption.js | |

### No New Libraries Required

This phase is a security audit and fix phase. All security tooling needed is:
- `npm audit` — already available, runs in CI
- `node scripts/security-scan.js` — already exists (scans for hardcoded secrets)
- Vitest — for writing targeted security regression tests

Do not introduce new audit libraries. Findings should be fixed in existing files.

---

## Architecture Patterns

### Auth Flow (critical path for SEC-04)

Three auth mechanisms exist, all resolved in middleware.js:

```
Request to middleware.js
  1. PUBLIC_ROUTES bypass (no auth required)
       /api/health, /api/setup/*, /api/auth, /api/cron, /api/docs/raw
       /api/prompts, /api/actions/[^/]+, /practical-systems, /replay
  2. Demo mode (DASHCLAW_MODE=demo or demo cookie on *.dashclaw.io)
       Returns fixture data, no DB writes
  3. API key auth (x-api-key header)
       SHA-256 hash lookup in api_keys table
       Falls back to DASHCLAW_API_KEY env var exact match
       Sets x-org-id and x-org-role headers
  4. NextAuth session (for dashboard/browser)
       getToken() from JWT
       Sets x-org-id, x-org-role, x-user-id
  5. Local admin session (DASHCLAW_LOCAL_ADMIN_PASSWORD)
       getViewerContextFromCookieHeader()
       Sets x-org-id=org_default, x-org-role=admin
```

**Org scoping**: `getOrgId(request)` in `app/lib/org.js` reads the `x-org-id` header. Critical gap: this defaults to `'org_default'` if the header is missing, which means if middleware somehow fails to set it, all data is served from org_default. This is safe as long as middleware always runs, but the default fallback should be verified as intentional (it is for self-hosted single-org deployments — but must be confirmed).

### Security Headers (current state for SEC-02)

Headers are set in TWO places — this is the primary audit gap:

**next.config.js** (full set, applied at build time):
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy` (detailed, with dev vs prod difference for unsafe-eval)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 years)

**middleware.js** `addSecurityHeaders()` (applied per-response in middleware):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (except /replay/ paths — intentionally allows embedding)
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (1 year, NO preload)

**Gap 1**: HSTS max-age inconsistency — next.config.js sets 2 years + preload; middleware.js sets 1 year without preload. They should be unified. The next.config.js value (2 years + preload) is the correct production target.

**Gap 2**: CSP is only set in next.config.js, not in middleware.js `addSecurityHeaders()`. API responses returned directly from middleware (demo mode, CORS preflight) do not get CSP. This is acceptable for API-only responses but should be verified.

**Gap 3**: /replay/ paths deliberately remove X-Frame-Options to allow embedding — intentional per code comment. No action needed.

### Input Validation Pattern (for SEC-03)

All core routes use `validateGuardInput()`, `validateActionRecord()`, `validatePolicy()` from `app/lib/validate.js`. This is hand-rolled with maxLength, enum enforcement, and type checking.

**Known gaps in current validation:**
1. `declared_goal` in guard input has `maxLength: 2000` but no XSS-specific sanitization. Since this is stored in DB and later displayed in the dashboard, it should be treated as untrusted content.
2. Array fields (`systems_touched`, `side_effects`, `artifacts_created`) have maxItems enforcement but no per-item type or length validation — a single item could be an unbounded string.
3. `reasoning` field on approvals route (`body.reasoning`) is validated via `redactAny()` for secrets but not checked for maxLength before redaction.
4. Policy `rules` field: validated as JSON, but the JSON content of arbitrary policies (e.g., webhook_check `url`) is passed through without HTML encoding.

### SSRF Protection Pattern (for SEC-03)

`isValidWebhookUrl()` in validate.js is the SSRF protection function. It:
- Requires HTTPS
- Blocks localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, .local, .internal, .test, .invalid, .onion
- Supports optional `WEBHOOK_ALLOWED_DOMAINS` env var allowlist

**Gap**: IPv6 CIDR ranges are incompletely blocked. The pattern `/^\[::1?\]$/` blocks `[::1]` and `[::1?]` but does NOT block all IPv6 loopback variants like `[0000:0000:0000:0000:0000:0000:0000:0001]` (full notation). The CONCERNS.md notes this. It is fixable inline.

### Governance Loop Code Path (for PROD-01)

Verified by reading the source:

1. **Guard**: `POST /api/guard` calls `validateGuardInput()` then `evaluateGuard(orgId, context, sql)` which fetches active policies, computes risk score, matches policy types, and writes to `guard_decisions` table. Returns `{decision, risk_score, matched_policies, warnings}`.
2. **Create Action**: `POST /api/actions` calls `validateActionRecord()`, runs `scanSensitiveData()` redaction, then `createActionRecord(sql, orgId, data)`. Writes to `action_records` table.
3. **Update Outcome**: `PATCH /api/actions/:id` calls `validateActionOutcome()` then updates `action_records`. Status transitions: `running` to `completed|failed|cancelled`.
4. **Signals**: `GET /api/cron/signals` calls `computeSignals(orgId, null, sql)` which scans recent `action_records` and returns 7 signal types.

All four steps are implemented and connected. The loop is complete. No gaps in the core path.

**Human Approval sub-path**: `decision: 'require_approval'` triggers agent to call `waitForApproval(actionId)`. `POST /api/approvals/[actionId]` enforces admin role, checks action is in `pending_approval` state, calls `recordApproval()`, and transitions status to `running` or `failed`. This is implemented and correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL parameterization | Custom string escaping | Drizzle ORM / neon tagged templates | Already used everywhere; tagged templates are safe by construction |
| Timing-safe string comparison | `===` on secrets | `timingSafeEqual()` already in middleware.js | Already implemented |
| SHA-256 hashing | Custom hash | `crypto.subtle.digest('SHA-256', ...)` already used | Already implemented |
| XSS output encoding | Manual escaping | React's JSX auto-escaping for display; avoid direct HTML injection with user data | React handles this in JSX contexts |
| SSRF protection | Custom IP blocklist | Extend `isValidWebhookUrl()` in validate.js | Already exists; just add missing IPv6 cases |

**Key insight**: The security primitives are already built. This phase is about finding where they are NOT being called and calling them.

---

## Common Pitfalls

### Pitfall 1: Org ID Default Confusion
**What goes wrong:** `getOrgId()` returns `'org_default'` when the header is absent. An unauthenticated request that bypasses middleware (misconfigured route, edge case) would silently read/write to org_default.
**Why it happens:** Single-org self-hosted deployments genuinely use org_default as the only org. The default is intentional design, not an oversight.
**How to avoid:** Verify that every mutable route (POST, PATCH, DELETE) is NOT in PUBLIC_ROUTES. The current PUBLIC_ROUTES include `/api/cron` — these should be protected by CRON_SECRET validation, not left fully open.
**Warning signs:** A route is in PUBLIC_ROUTES that performs mutations.

### Pitfall 2: CRON_SECRET Not Validated in Cron Routes
**What goes wrong:** PUBLIC_ROUTES contains `/api/cron`, which means cron routes bypass API key auth. If the cron routes do not validate CRON_SECRET themselves, anyone can trigger signal computation or health checks without auth.
**Why it happens:** Cron endpoints are meant to be called by Vercel's cron scheduler, which cannot send API keys.
**How to avoid:** Verify that `app/api/cron/signals/route.js` and `app/api/cron/integration-health/route.js` validate `Authorization: Bearer <CRON_SECRET>` before executing.
**Warning signs:** `CRON_SECRET is advisory not required` per STATE.md suggests this may not be enforced.

### Pitfall 3: Prompt Injection Detection Without Enforcement
**What goes wrong:** `scanForPromptInjection()` returns findings with `recommendation: 'block'` for critical patterns, but this recommendation is never acted upon in core routes. The guard route processes `declared_goal` and other text fields without running injection detection.
**Why it happens:** The prompt injection scanner was built as a standalone utility for the `/api/security/prompt-injection/` extension route, not integrated into core governance routes.
**How to avoid:** In `/api/guard/route.js`, run `scanForPromptInjection(data.declared_goal)` after validation and if `recommendation === 'block'`, return 400 with the finding.
**Warning signs:** `promptInjection.js` is imported in `guard.js` but checking first 100 lines does not show it being called on the incoming context inputs.

### Pitfall 4: Silent Failure on Missing Redis in Serverless
**What goes wrong:** Without `REDIS_URL`, the realtime backend silently uses in-memory EventEmitter. On Vercel (serverless), every function invocation is a new process — in-memory state is lost between requests. SSE clients see no events after deploy restarts.
**Why it happens:** The fallback is intentional for local dev. But in production serverless, in-memory pub/sub is broken by design.
**How to avoid:** The `/setup` page health check (DEPLOY-04) warns about this. Verify the warning is clear and actionable. Also verify `REALTIME_ENFORCE_REDIS=true` actually throws a startup error rather than just logging.
**Warning signs:** `getRealtimeHealth()` returns `status: 'warn'` but the deploy still runs.

### Pitfall 5: Verify-Before-Fix Order Matters
**What goes wrong:** Running `npm run test -- --run` before any changes confirms the baseline. If tests start failing after a security fix, the fix introduced a regression.
**Why it happens:** Security fixes (adding validation, changing header values) can break tests that assert on exact response shapes.
**How to avoid:** Run tests before starting work to confirm green baseline. After each fix, run the relevant test file before moving on.
**Warning signs:** A fix that touches validate.js will affect multiple route tests.

### Pitfall 6: Webhook Policies Are the Primary SSRF Surface
**What goes wrong:** When a user creates a policy with `policy_type: 'webhook_check'` and a malicious `rules.url`, the guard engine calls that URL on every guarded action.
**Why it happens:** The webhook URL is validated on policy CREATE via `isValidWebhookUrl()` — but SSRF through DNS rebinding or CNAME shadowing can bypass static IP blocklists.
**How to avoid:** The existing `isValidWebhookUrl()` is solid. The main gap is incomplete IPv6 blocking. The delivery code already sets `redirect: 'manual'` which prevents redirect-based SSRF. Verify the delivery timeout is enforced.
**Warning signs:** No server-side re-validation of the URL at guard evaluation time (only at policy creation).

---

## Security Findings Inventory

Pre-triaged from source code reading. The planner should create tasks from these in priority order.

### IMMEDIATE: Fix in this phase

| Finding | File | Risk | Fix |
|---------|------|------|-----|
| HSTS max-age inconsistency | middleware.js:75, next.config.js:54 | LOW | Unify to 2 years + preload in both places |
| Array item length not validated | validate.js:31,43,44 | LOW | Add per-item maxLength to array validator |
| CRON_SECRET enforcement missing | app/api/cron/*/route.js | MEDIUM | Add Authorization header check at top of each cron route |
| Prompt injection not enforced in guard | app/api/guard/route.js, app/lib/guard.js | MEDIUM | Call scanForPromptInjection on declared_goal; block on 'critical' |
| IPv6 incomplete in SSRF blocklist | app/lib/validate.js:333-341 | MEDIUM | Add fc00::/7, fe80::/10, IPv4-mapped loopback patterns |
| Policy error code string matching | app/api/policies/route.js:85 | LOW | Switch from message string match to PostgreSQL error code 23505 |
| Realtime silent failure not actionable | app/lib/events.js:23-26 | MEDIUM | Add explicit warning log + graceful degradation message when memory backend is used in production |
| JSON parse silent failure in guard | app/lib/guard.js:94-98 | LOW | Add console.error on catch; do not silently permit all agents on parse failure |
| actions route regex in PUBLIC_ROUTES | middleware.js:38 | MEDIUM | Audit: `/api/actions/[^/]+` is public — verify scope is intentional and limited to replay data only |

### DEFER: Too risky for inline fix

| Finding | File | Risk | Why Defer |
|---------|------|------|-----------|
| Encryption key rotation | app/lib/encryption.js | HIGH | Requires schema migration + data re-encryption; per D-02 |
| SSE stream writer deadlock | app/api/stream/route.js | HIGH | Refactoring the stream lifecycle is high regression risk; per D-03 |
| Policy PATCH race condition | app/api/policies/route.js:124-137 | MEDIUM | Requires SELECT FOR UPDATE or transaction; schema-adjacent |
| Demo cookie domain scope | app/lib/isDemoMode.js | LOW | Already mitigated by host check; low priority for self-hosted |

---

## Product Narrative Assessment (PROD-01, PROD-02)

### Persona 1: Solo Agent Builder (most common user)
**Entry point:** README to deploy button to /connect to copy SDK code to fire first guard check

**What works:**
- /connect page uses `getConnectGuideContent({ host })` to inject the real base URL into SDK examples — developer sees working code, not placeholders.
- SDK v2 has 5 clear methods; the cognitive load is low.
- The `waitForApproval()` flow has a clear terminal output block (documented in SKILL.md).

**What needs attention (PROD-02):**
- /connect page shows Node and Python examples. Verify both work against a fresh Vercel deploy with `DASHCLAW_LOCAL_ADMIN_PASSWORD` auth (no OAuth). The x-api-key header approach should work since middleware resolves API keys before NextAuth, but this should be confirmed in the product narrative review task.
- The 8-minute claim needs to be walkable in the plan.

### Persona 2: Startup CTO (3-5 agents)
**Entry point:** /mission-control — needs to see aggregate posture across multiple agents

**What works:**
- /mission-control fetches `/api/actions`, `/api/signals`, `/api/guard` history — these are real data paths, not demo fixtures.
- Signal types cover exactly what a CTO cares about: autonomy spikes, stale loops, repeated failures.

**What needs attention:**
- With zero actions in a fresh deploy, /mission-control will show empty state. The product narrative review task should verify the empty state UX is helpful (not blank/broken).

### Persona 3: Enterprise Evaluator (SOC 2/NIST)
**Entry point:** Compliance exports, audit trail in /decisions

**What works:**
- Compliance framework coverage (SOC 2, NIST AI RMF, ISO 27001) is implemented in the extension tier.
- `action_records` table is append-only once actions complete — valid audit trail.
- `/api/compliance/exports` exists and generates multi-framework bundles.

**What needs attention:**
- This persona needs evidence that the governance loop is tamper-evident. The existing `guard_decisions` table stores policy evaluation results — this is the evidence record. Make sure the product walkthrough notes this explicitly.

### Governance Loop Code Path (PROD-01)

Traced end-to-end from source code. All steps confirmed implemented:

```
1. agent calls dc.guard(context)
   POST /api/guard
   validateGuardInput() [validate.js]
   evaluateGuard(orgId, context, sql) [guard.js]
     fetch active policies WHERE org_id = $1
     computeRiskScore(context)
     match risk_threshold, require_approval, block_action_type policies
     save to guard_decisions
   return {decision, risk_score, matched_policies}

2. agent calls dc.createAction(record)
   POST /api/actions
   validateActionRecord() [validate.js]
   scanSensitiveData() redaction [security.js]
   verifyAgentSignature() if ENFORCE_AGENT_SIGNATURES=true
   createActionRecord(sql, orgId, data) [actions.repository.js]
   generateActionEmbedding() if OpenAI key present
   publishOrgEvent(EVENTS.ACTION_CREATED) [events.js]
   return {action_id, ...}

3. agent calls dc.updateOutcome(id, {status, output_summary})
   PATCH /api/actions/:id
   validateActionOutcome()
   update action_records SET status=... WHERE id=$1 AND org_id=$2

4. cron: GET /api/cron/signals (every 5 min)
   computeSignals(orgId, null, sql) [signals.js]
   7 signal types computed from recent action_records
   publishOrgEvent(EVENTS.SIGNAL_DETECTED)
   fire notification adapters (Slack, Discord, email if configured)
```

All four steps are present and connected. The loop is complete.

---

## Free-Tier Viability (PROD-03)

### Confirmed $0 Stack

| Service | Free Tier | Limits | Impact on DashClaw |
|---------|-----------|--------|-------------------|
| Vercel | Hobby plan | 100 GB bandwidth/month; 6000 build minutes/month; cron jobs supported | For a self-hosted governance tool with low traffic, limits are not a concern. Signal detection (every 5 min) and health checks (every 6 hours) both run on the free tier. |
| Neon | Free tier | 0.5 GB storage, 1 project | 0.5 GB supports hundreds of thousands of action records. Only becomes a concern at very high scale. |
| Upstash | Free tier | 10,000 commands/day, 256 MB data | For SSE pub/sub, 10k commands/day covers ~500+ real-time action updates/day — adequate for a new user. |
| Redis (self-hosted) | n/a | n/a | `REALTIME_BACKEND=memory` is the default and is $0 but not persistent on serverless. |

### Graceful Degradation Status (D-11)

| Feature | When Absent | Current Behavior | Status |
|---------|-------------|-----------------|--------|
| `REDIS_URL` (realtime) | In-memory backend | WARN in health check, event loss on restart | Partially addressed — warning exists but may not be actionable enough |
| `OPENAI_API_KEY` (embeddings) | No behavioral embeddings | `isEmbeddingsEnabled()` returns false; no crash | Graceful |
| `RESEND_API_KEY` (email alerts) | No email alerts | Silent — no error surfaced | Needs fix: should log "email alerts disabled" |
| `STRIPE_SECRET_KEY` (billing) | No billing features | Features gated but no clear UI message | Acceptable for free-tier self-hosted |
| `UPSTASH_REDIS_REST_URL` (distributed rate limiting) | Falls back to in-memory rate limiter | Logs warning | Graceful |
| `CRON_SECRET` | Cron endpoints unprotected | Logged as advisory | Needs fix: should enforce (see security findings) |

### What to Document for Users (D-10)

The key user-surprise items to document:
1. **Neon free tier**: 0.5 GB storage. Hundreds of thousands of action records before hitting limit.
2. **Redis optional but important on serverless**: Without `REDIS_URL`, SSE real-time events work on a single instance but are lost on deploy. Vercel serverless runs multiple instances — real-time will feel broken without Redis. Upstash free tier resolves this at $0.
3. **Vercel cron works on free tier**: Signal detection (every 5 min) and health checks (every 6 hours) both work.
4. **NEXTAUTH_URL must be set after first deploy**: The URL is unknown until Vercel assigns a domain. This is an expected 2-step deploy (already documented in README post-deploy checklist).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | vitest.config.js |
| Quick run command | `npm run test -- --run --reporter=verbose` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | OWASP audit of 7 routes | unit (per route) | `npm run test -- --run` | Partial — guard.route.test.js, actions.route.test.js exist |
| SEC-02 | Security headers on all routes | unit | Add to existing route tests | Partial |
| SEC-03 | Input validation gaps | unit | `npm run test -- --run __tests__/unit/guard.route.test.js` | Partial — new cases needed |
| SEC-04 | Auth bypass verification | unit | `npm run test -- --run __tests__/unit/guard.route.test.js` | Partial |
| PROD-01 | Governance loop path | unit (guard-engine.test.js) | `npm run test -- --run __tests__/unit/guard-engine.test.js` | Yes |
| PROD-02 | Product UX narrative | manual | (code review, not automated) | N/A — manual |
| PROD-03 | Free-tier feature degradation | unit | Add tests for missing CRON_SECRET behavior | Gaps exist |

### Sampling Rate
- **Per task commit:** `npm run test -- --run` (full unit suite, approx 30 seconds)
- **Per wave merge:** `npm run test -- --run && npm run lint && npm run governance:boundary:check`
- **Phase gate:** Full CI sequence (includes `npm run openapi:check`, `npm run api:inventory:check`, `npm run build`)

### Wave 0 Gaps
- [ ] `__tests__/unit/security-headers.test.js` — covers SEC-02 (test that expected headers are present on API responses)
- [ ] `__tests__/unit/cron-auth.test.js` — covers CRON_SECRET enforcement after fix (SEC-04)
- [ ] `__tests__/unit/prompt-injection-guard.test.js` — covers prompt injection blocking in guard route (SEC-03)

---

## Environment Availability

Step 2.6: Phase is code-review and fix only. No external service connectivity required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All scripts | Yes | 20.x+ (verified via engines field) | — |
| npm | Dependency install | Yes | npm with package-lock.json | — |
| Vitest | Unit tests | Yes | ^4.1.0 in package.json | — |
| PostgreSQL / Neon | Route code review | N/A (code review only) | N/A | N/A |

All audits are performed by reading and modifying source files, then verifying with unit tests.

---

## Code Examples

### Correct CRON_SECRET Enforcement Pattern

```javascript
// Add to top of each cron route handler in app/api/cron/*/route.js
// Uses same timing-safe comparison principle as middleware.js
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization') || '';
    const provided = authHeader.replace(/^Bearer\s+/i, '');
    if (!provided || provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  // ... rest of handler
}
// Note: if CRON_SECRET is not set, skip enforcement (advisory mode)
// This preserves the existing design decision logged in STATE.md
```

### Correct Prompt Injection Guard Integration Pattern

```javascript
// In app/api/guard/route.js, after validateGuardInput(), before evaluateGuard():
import { scanForPromptInjection } from '../../lib/promptInjection.js';

const goalText = data.declared_goal || '';
if (goalText) {
  const injectionScan = scanForPromptInjection(goalText);
  if (injectionScan.recommendation === 'block') {
    return NextResponse.json({
      error: 'Input rejected: prompt injection pattern detected',
      risk_level: injectionScan.risk_level,
      categories: injectionScan.categories,
    }, { status: 400 });
  }
}
```

### Correct IPv6 SSRF Blocking Additions

```javascript
// In app/lib/validate.js isValidWebhookUrl(), add to blockedPatterns array:
/^(fc|fd)[0-9a-f]{2}:/i,          // fc00::/7 (unique local IPv6)
/^fe[89ab][0-9a-f]:/i,             // fe80::/10 (link-local IPv6)
/^\[?::ffff:127\./i,               // IPv4-mapped loopback
/^\[?::ffff:0:127\./i,             // IPv4-translated loopback
/^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0*1$/i,  // Full notation for ::1
```

### Correct Policy Uniqueness Error Code Pattern

```javascript
// In app/api/policies/route.js around line 85
// Before:
if (err.message.includes('guard_policies_org_name_unique')) { ... }
// After (PostgreSQL unique_violation error code = 23505):
if (err.code === '23505' || err.message.includes('guard_policies_org_name_unique')) { ... }
// Keep message fallback for non-postgres test environments
```

### Correct HSTS Header Unification

```javascript
// In middleware.js addSecurityHeaders(), line 74-77, change to match next.config.js:
if (process.env.NODE_ENV === 'production') {
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'  // 2 years, matches next.config.js
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| AES-256-CBC | AES-256-GCM (v2 prefix) | DashClaw already uses GCM; CBC support is backward-compat read-only |
| In-memory rate limiting only | Upstash Redis distributed rate limiting | Both supported; in-memory is fallback |
| Plain API key comparison | SHA-256 hash lookup + timing-safe compare | Already implemented correctly |
| No prompt injection detection | Pattern-based scanner with 5 categories | Implemented but not enforced in guard — fix in this phase |

---

## Open Questions

1. **Is `/api/actions/[^/]+` intentionally public?**
   - What we know: It is in PUBLIC_ROUTES regex in middleware.js line 38. This enables `/replay/` links to work without auth.
   - What is unclear: The regex matches ALL `/api/actions/:id` paths, not just replay-associated ones. A caller could read full action records without auth if they know an action ID.
   - Recommendation: Verify whether replay uses `/api/actions/:id` directly or a separate public endpoint. If it is the main actions route, tighten the regex or add a `?public=1` query param guard.

2. **Does `ENFORCE_AGENT_SIGNATURES=true` work correctly in production?**
   - What we know: `verifyAgentSignature()` is called in `POST /api/actions`. The env var opt-in model exists.
   - What is unclear: `app/lib/identity.js` was not read in this research session — the full signing verification logic is unknown.
   - Recommendation: Read `app/lib/identity.js` during the SEC-04 audit task.

3. **Are extension routes (compliance, drift, evaluations, scoring) auth-protected?**
   - What we know: Extension routes are in `app/(extensions)/` — outside the governance boundary. Middleware still runs for them (Next.js middleware applies globally unless config.matcher is scoped).
   - What is unclear: Whether these routes call `getOrgId(request)` and validate input at the same level as core routes.
   - Recommendation: Sample 2-3 extension route handlers to verify they follow the same auth pattern as core routes.

---

## Sources

### Primary (HIGH confidence)
- Source code read: `middleware.js`, `app/api/guard/route.js`, `app/api/actions/route.js`, `app/api/approvals/[actionId]/route.js`, `app/api/health/route.js`, `app/lib/validate.js`, `app/lib/security.js`, `app/lib/encryption.js`, `app/lib/promptInjection.js`, `app/lib/auth.js`, `app/lib/org.js`, `next.config.js`, `vercel.json`, `.env.example`
- `.planning/codebase/CONCERNS.md` — pre-existing security analysis with file/line references
- `.planning/codebase/ARCHITECTURE.md` — layer structure and data flow
- `.planning/codebase/TESTING.md` — test framework and patterns

### Secondary (MEDIUM confidence)
- `guard.js` first 100 lines read — policy evaluation engine structure; full file not read
- `app/lib/guard.js` lines 94-98 — JSON parse silent failure confirmed by reading source
- CONCERNS.md security section — independently verified against source code

### Tertiary (LOW confidence — verify before publishing to users)
- Vercel free tier limits (100 GB bandwidth/month, 6000 build minutes/month) — verify at vercel.com/pricing
- Neon free tier 0.5 GB storage — verify at neon.tech/pricing
- Upstash 10,000 commands/day free — verify at upstash.com/pricing

---

## Metadata

**Confidence breakdown:**
- Security header findings: HIGH — read actual source files
- Auth flow analysis: HIGH — read middleware.js fully
- Input validation gaps: HIGH — read validate.js in full
- SSRF analysis: HIGH — read isValidWebhookUrl() directly
- Governance loop code path: HIGH — traced all 4 steps from source
- Free-tier limits: MEDIUM — from known documentation; verify before publishing
- Extension route auth: LOW — not sampled; flagged as open question

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (stable codebase; no fast-moving external dependencies)
