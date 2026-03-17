# Phase 1: Deploy Funnel - Research

**Researched:** 2026-03-17
**Domain:** Vercel one-click deploy, vercel.json configuration, Next.js health checks, Drizzle schema migration
**Confidence:** HIGH (all primary claims verified against official Vercel docs and direct codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **NEXTAUTH_URL**: Manual post-deploy step — user updates NEXTAUTH_URL to their deployment URL after first deploy. Do NOT use `$VERCEL_URL` substitution. `/setup` detects mismatch and surfaces warning.
- **Redis**: Optional at deploy time. `/setup` shows "Upgrade to live stream" when Redis is absent on Vercel. In-memory fallback acceptable for evaluation.
- **Deploy button scope**: Prompts exactly 6 required env vars (DATABASE_URL, DASHCLAW_API_KEY, ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET) plus DASHCLAW_LOCAL_ADMIN_PASSWORD as 7th. Neon `integration-ids`/`products` must be verified before shipping.
- **vercel.json**: Add `framework: "nextjs"`, register crons (`/api/cron/signals` every 5 min, `/api/cron/integration-health` every 6 hours), set `buildCommand: "npm run db:push && next build"`. Verify `db:push` idempotency first.
- **Health check enhancements**: Extend existing `getReadinessReport()` in `app/lib/readiness.mjs`. No new page, no new API route. Four new checks: NEXTAUTH_URL mismatch, realtime backend type, CRON_SECRET presence, schema migration status.
- **README deploy section**: Deploy button above the fold. 3-step post-deploy checklist below. Link to `docs/deploy-without-oauth.md`. "$0 deploy" callout.

### Claude's Discretion

- Exact deploy button URL query parameter formatting
- README section layout and badge styling
- Health check warning copy and severity levels
- Whether to add deploy button to `/self-host` page in addition to README

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | One-click Vercel deploy button in README above the fold, parameterized with exactly 6 required env vars | Deploy button URL format verified (HIGH). `env` + `envDescription` + `envLink` + `envDefaults` params confirmed from Vercel docs. Neon `products=` slug format is the current Vercel-managed path (not `integration-ids`). |
| DEPLOY-02 | `vercel.json` registers cron routes and sets `buildCommand` to run `npm run db:push && next build` | `vercel.json` cron format confirmed. `db:push` idempotency confirmed (no data loss on existing schema; no `--force` flag means destructive ops require confirmation). `buildCommand` chaining with `&&` is standard. |
| DEPLOY-03 | Post-deploy setup instructions cover NEXTAUTH_URL update, Upstash Redis setup, `/setup` as verification page | README structure pattern documented. Copy guidance based on pitfall analysis. |
| DEPLOY-04 | `/setup` page health checks include NEXTAUTH_URL detection, realtime backend warning, schema migration status, CRON_SECRET presence | All four checks plug into existing `getReadinessReport()` via `checkConfiguration` extension and a new `buildDeploySection`. Existing `checkCoreTables()` and `getRealtimeHealth()` are reusable. |
</phase_requirements>

---

## Summary

This phase is purely additive at the edges of the existing codebase. The governance runtime is feature-complete; all work is configuration, documentation, and extending the existing readiness check system. No new routes, no new pages, no new runtime logic.

The three work streams are: (1) `vercel.json` configuration — 15 lines of JSON, (2) deploy button URL construction in README, and (3) extending `getReadinessReport()` with four new health checks that surface in the existing `TopSummary` / `VerificationSection` components via the established section/check/status pattern.

The only non-trivial question was `db:push` idempotency (confirmed safe) and the Neon integration URL format (now uses `products=` slug JSON, not the `integration-ids=oac_*` format documented in earlier research). The `oac_VqOgBHqhEoFTPzGkPd7L0iH6` ID cited in CONTEXT.md is LOW confidence and should be replaced with the slug-based format confirmed from the Neon official template.

**Primary recommendation:** Use the `products=` slug-based Neon integration parameter in the deploy button URL (current official pattern as of 2025), add `skippable-integrations=1` so users without a Neon account can still proceed, and extend `configurationCheck.mjs`'s `ADVISORY_ENV_VARS` for the simpler checks while adding a dedicated deploy readiness section for the richer NEXTAUTH_URL mismatch logic.

---

## Standard Stack

### Core (no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | ^16.1.6 (project pin) | Server component for `/setup` page | Already in use |
| Drizzle Kit | project pin | `db:push` schema migration | Already in use |
| Vitest | ^4.1.0 | Unit tests for new health check logic | Already in use |

### No New Dependencies

All phase 1 work uses existing project dependencies. The deploy button is a URL (no code). The `vercel.json` changes are pure configuration. The health checks are new functions inside existing files.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (affected files only)

```
vercel.json                                  # Root — update from {} to full config
README.md                                    # Root — add deploy button above the fold
app/lib/readiness/
├── constants.mjs                            # Add CRON_SECRET to ADVISORY_ENV_VARS
├── configurationCheck.mjs                   # Existing — CRON_SECRET check lands here automatically
└── deployCheck.mjs                          # NEW — NEXTAUTH_URL mismatch + realtime backend check
app/lib/readiness.mjs                        # Add deployCheck call into getReadinessReport()
__tests__/unit/
└── readiness.test.js                        # Add tests for four new checks
```

### Pattern 1: vercel.json Cron Registration

**What:** Vercel reads `crons` array from `vercel.json` to register scheduled invocations. Routes must exist in the app.
**When to use:** Any route that needs periodic invocation on Vercel infrastructure.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run db:push && next build",
  "crons": [
    {
      "path": "/api/cron/signals",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/integration-health",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Source: [Vercel project configuration docs](https://vercel.com/docs/project-configuration/vercel-json) — confirmed HIGH confidence.

### Pattern 2: Vercel Deploy Button URL

**What:** URL query parameters that configure the Vercel project creation flow.
**When to use:** README badge linking to one-click deploy.

Confirmed parameters (HIGH confidence from [official docs](https://vercel.com/docs/integrations/deploy-button/environment-variables)):

| Parameter | Type | Purpose |
|-----------|------|---------|
| `repository-url` | string | URL-encoded GitHub repo to clone |
| `env` | string (comma-separated) | Env var keys user must fill in |
| `envDescription` | string | Caption below env var fields |
| `envLink` | string | "Learn more" URL |
| `envDefaults` | string (JSON URI-encoded) | Non-sensitive default values (NEW — not in prior research) |
| `project-name` | string | Pre-fills Vercel project name |
| `repository-name` | string | Pre-fills forked repo name |
| `integration-ids` | string (comma-separated) | Required integrations by `oac_` ID |
| `skippable-integrations` | number (1) | Makes integration-ids optional |
| `products` | JSON URI-encoded | Newer slug-based integration provisioning |

**Critical finding — Neon integration parameter format has changed:**
The official Neon template (as of 2025) uses `products=` with a JSON slug object, NOT `integration-ids=oac_*`:
```
products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D
```
Decoded: `[{"type":"integration","integrationSlug":"neon","productSlug":"neon","protocol":"storage"}]`

Source: [neondatabase/vercel-marketplace-neon](https://github.com/neondatabase/vercel-marketplace-neon) — MEDIUM confidence (official Neon repo, but `products` param not yet in official Vercel docs; may be newer API).

**Fallback approach:** If `products=` does not work, use `integration-ids` with `skippable-integrations=1` and the Neon `oac_` ID. The community-sourced Neon ID is `oac_3sK3gnG06emjIEVL09jjntDD` (LOW confidence — sourced from Vercel Community forum, single reference, unverified against live marketplace). The previously cited `oac_VqOgBHqhEoFTPzGkPd7L0iH6` ID from CONTEXT.md is also LOW confidence.

**Recommended strategy:** Use `products=` slug format with `skippable-integrations=1`. This matches the current official Neon template. Since Neon integration is skippable (DATABASE_URL remains in `env=` as a required field), users without a Neon account still see the DATABASE_URL field and can paste their own connection string.

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw&env=DATABASE_URL,DASHCLAW_API_KEY,ENCRYPTION_KEY,NEXTAUTH_SECRET,NEXTAUTH_URL,CRON_SECRET,DASHCLAW_LOCAL_ADMIN_PASSWORD&envDescription=Required+DashClaw+configuration.+See+.env.example+for+details.&envLink=https%3A%2F%2Fgithub.com%2Fucsandman%2FDashClaw%2Fblob%2Fmain%2F.env.example&project-name=my-dashclaw&repository-name=my-dashclaw&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D&skippable-integrations=1
```

Note: `NEXTAUTH_URL` must be in `env=` with no default — users must enter their deployment URL consciously. Do NOT use `envDefaults` for NEXTAUTH_URL. Per official Vercel docs: "Never use default values for sensitive data."

**README badge markdown:**
```markdown
[![Deploy with Vercel](https://vercel.com/button)](DEPLOY_URL_HERE)
```

### Pattern 3: Extending getReadinessReport() — Deploy Health Section

**What:** New checks added to the readiness report follow the `createSection()` + `createCheck()` factory pattern established in `app/lib/readiness/`.
**When to use:** Any new health check that should surface on `/setup`.

The setup page receives the report via `getReadinessReport()` and renders all `sections` via `VerificationSection`. Adding a new section automatically surfaces it. The `TopSummary` component drives its state from `view.verification.overall`, which is computed from section `.ok` flags.

**Four new checks and where they land:**

| Check | Where | Method |
|-------|-------|--------|
| CRON_SECRET presence | `constants.mjs` ADVISORY_ENV_VARS | Add entry — `checkConfiguration` handles it automatically |
| NEXTAUTH_URL mismatch vs current host | New `deployCheck.mjs` section | Compare `env.NEXTAUTH_URL` host to `options.host` from `headers()` |
| Realtime backend (in-memory on Vercel) | New `deployCheck.mjs` section | Check `env.REALTIME_BACKEND`, `env.VERCEL`, `env.UPSTASH_REDIS_REST_URL` |
| Schema migration status | Already handled by `db` section via `checkCoreTables()` | No new work — schema check already in report |

**Key insight on schema check:** The existing `buildDatabaseSection()` already surfaces "schema migration has not run" as a `fail` check when `db:push` hasn't been run. DEPLOY-04 requirement for "schema migration status" is already satisfied — no new check needed.

**NEXTAUTH_URL mismatch logic:**
```javascript
// Source: app/setup/page.js — host is already derived from headers()
// Pattern: compare NEXTAUTH_URL env var host to current request host
function checkNextAuthUrlMismatch(env, host) {
  const configuredUrl = env.NEXTAUTH_URL || '';
  if (!configuredUrl) return { mismatch: false, configured: false };
  try {
    const configured = new URL(configuredUrl);
    const mismatch = configured.host !== host;
    return { mismatch, configured: true, configuredHost: configured.host, currentHost: host };
  } catch {
    return { mismatch: true, configured: false };
  }
}
```

**Realtime backend detection logic:**
```javascript
// env.VERCEL is set by Vercel runtime; env.VERCEL_ENV is 'production'|'preview'|'development'
function checkRealtimeBackend(env) {
  const isVercel = Boolean(env.VERCEL);
  const backend = (env.REALTIME_BACKEND || 'memory').toLowerCase();
  const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  const hasRedis = Boolean(env.REDIS_URL || hasUpstash);
  const isMemoryOnServerless = isVercel && backend === 'memory' && !hasRedis;
  return { isVercel, backend, hasRedis, isMemoryOnServerless };
}
```

### Pattern 4: Existing Section/Check Shape

All new sections must follow this shape (from `factories.mjs`):

```javascript
createSection({
  id: 'deploy',          // unique, lowercase
  title: 'Deploy Readiness',
  status: 'warn',        // pass | warn | fail | info
  description: '...',
  summary: '...',
  whatWasChecked: '...',
  evidenceSummary: '...',
  pendingProof: '',
  checks: [...],
  ok: true,
})
```

Check status values: `pass`, `warn`, `fail`, `info`. Use `warn` for advisory issues (Redis missing on Vercel, NEXTAUTH_URL mismatch). Use `fail` only for blockers.

### Anti-Patterns to Avoid

- **Adding a new API route for deploy health**: The existing `/api/health/route.js` and `/setup` architecture already cover all needed surfaces. No new routes.
- **Using `$VERCEL_URL` in vercel.json env block**: This is for preview deployments only and is not a stable production URL. Locked decision per CONTEXT.md.
- **Setting NEXTAUTH_URL in `envDefaults`**: Vercel docs explicitly prohibit `envDefaults` for sensitive/deployment-specific values. NEXTAUTH_URL must be a required field users fill in manually.
- **Using `integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6`**: This ID is LOW confidence and the format has shifted to `products=` slug. Use slug format.
- **Adding `db:push` to a startup route**: Less reliable than `buildCommand` since serverless functions may time out during first-request migration. `buildCommand` runs at build time in a non-serverless context.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema table detection | Custom SQL introspection | `checkCoreTables()` in `app/lib/schemaCheck.js` | Already queries `information_schema.tables`; already used by health endpoint |
| Realtime backend type | New env var inspection | `getRealtimeHealth()` in `app/lib/events.js` | Already returns `{ backend, status }` distinguishing memory vs redis |
| Section/check factory | Custom object shape | `createSection()` / `createCheck()` in `app/lib/readiness/factories.mjs` | Establishes consistent shape expected by VerificationSection component |
| Host detection | Parse request URL manually | `headers()` already called in `app/setup/page.js`; `host` passed as `options.host` to `getReadinessReport()` | Already threaded through the system |

**Key insight:** The hardest work in this phase is already done. The schema check, realtime detection, and host extraction all exist. The phase is wiring them together with the right status labels and copy.

---

## Common Pitfalls

### Pitfall 1: NEXTAUTH_URL Chicken-and-Egg
**What goes wrong:** User deploys but cannot log in because NEXTAUTH_URL points to localhost or is wrong domain.
**Why it happens:** The Vercel deployment URL is not known until after the first deploy completes. The user fills in the env var form before the URL exists.
**How to avoid:** NEXTAUTH_URL must be in `env=` with no `envDefaults` value. Post-deploy README step 1 says: "Copy your Vercel URL, set NEXTAUTH_URL, redeploy." `/setup` NEXTAUTH_URL mismatch check (new) flags this immediately.
**Warning signs:** User reports "sign in doesn't work" or redirect loop within 5 minutes of first deploy.

### Pitfall 2: `db:push` Behavior on Schema Drift
**What goes wrong:** `buildCommand: "npm run db:push && next build"` runs on every redeploy, including hotfixes. If schema drift exists (model changed since last migration), `db:push` may ask for confirmation interactively.
**Why it happens:** Drizzle `push` is interactive by default for potentially destructive changes (adding NOT NULL columns without defaults, renaming columns).
**How to avoid:** Add `--accept-data-loss` flag or verify `drizzle.config.ts` has `verbose: false` and the deploy environment handles non-interactive confirmation. Alternatively, use `drizzle-kit migrate` with generated migration files for production — safer but requires migration file management. Per CONTEXT.md locked decision, `db:push` is the chosen approach but idempotency on existing schema must be verified in staging before first public deploy.
**Confidence:** MEDIUM — `drizzle-kit push` documentation confirms no data loss without `--force`, but interactive prompts on schema drift could block the Vercel build step.

### Pitfall 3: Silent Redis Fallback (CONCERNS.md documented bug)
**What goes wrong:** Mission Control live stream shows nothing on Vercel because each serverless function invocation has a fresh in-memory event bus.
**Why it happens:** `events.js` line 23 defaults to `memory` backend. No warning in logs.
**How to avoid:** New `/setup` realtime check warns: "Live stream requires Redis on serverless. Set UPSTASH_REDIS_REST_URL to enable Mission Control." This is informational (warn severity), not a blocker.
**Warning signs:** First-time deployers report "Mission Control shows nothing."

### Pitfall 4: Deploy Button `env=` Field Count
**What goes wrong:** Vercel's deploy button UI becomes overwhelming if too many env vars are listed. The 122-line `.env.example` must not be reproduced in the deploy form.
**How to avoid:** `env=` contains exactly 7 fields (6 required + DASHCLAW_LOCAL_ADMIN_PASSWORD). All other vars are optional and handled via documentation.

### Pitfall 5: Neon Integration Skippability
**What goes wrong:** If `products=` format fails silently or is not supported for a user's account tier, DATABASE_URL is never auto-populated and the deployment hangs.
**How to avoid:** Always include DATABASE_URL in `env=` even when using `products=` Neon integration. The Neon integration auto-fills DATABASE_URL if the user connects; if they skip it, the manual `env=` field accepts their own connection string. Add `skippable-integrations=1`.

---

## Code Examples

### vercel.json final state
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run db:push && next build",
  "crons": [
    {
      "path": "/api/cron/signals",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/integration-health",
      "schedule": "0 */6 * * *"
    }
  ]
}
```
Source: Vercel docs confirmed cron format, buildCommand override pattern.

### CRON_SECRET addition to constants.mjs
```javascript
// Source: app/lib/readiness/constants.mjs — ADVISORY_ENV_VARS
{
  key: 'CRON_SECRET',
  description: 'Secret token protecting /api/cron/* routes from unauthorized invocation',
  help: 'Generate with: openssl rand -hex 32 — then add to Vercel Project Settings > Environment Variables.',
},
```
Adding to ADVISORY_ENV_VARS (not REQUIRED) matches existing pattern: present = pass, absent = warn. This is less disruptive than REQUIRED (which would block `overall: healthy`).

### New deployCheck.mjs skeleton
```javascript
// app/lib/readiness/deployCheck.mjs
import { createSection, createCheck } from './factories.mjs';

export function buildDeploySection(env, host) {
  const nextAuthCheck = checkNextAuthUrl(env, host);
  const realtimeCheck = checkRealtimeBackend(env);

  const checks = [];
  // NEXTAUTH_URL check ...
  // Realtime backend check ...

  const ok = checks.every(c => c.status !== 'fail');
  const status = checks.some(c => c.status === 'fail') ? 'fail'
    : checks.some(c => c.status === 'warn') ? 'warn' : 'pass';

  return createSection({
    id: 'deploy',
    title: 'Deploy Readiness',
    status,
    description: 'Vercel-specific configuration checks for production readiness.',
    summary: ok ? 'Deploy configuration looks correct.' : 'Deploy configuration needs attention.',
    whatWasChecked: 'NEXTAUTH_URL vs current host, realtime backend on serverless.',
    evidenceSummary: '...',
    pendingProof: '',
    checks,
    ok,
  });
}
```

### README deploy section structure
```markdown
## Deploy

[![Deploy with Vercel](https://vercel.com/button)](DEPLOY_URL)

**$0 to deploy** — Vercel free tier + Neon free tier.

### After deploy (3 steps)

1. **Set NEXTAUTH_URL** — In Vercel → Project → Settings → Environment Variables, set `NEXTAUTH_URL` to your deployment URL (e.g., `https://my-dashclaw.vercel.app`). Redeploy once.
2. **Enable live stream (optional)** — Create a free [Upstash Redis](https://upstash.com) instance and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Required for Mission Control live decision stream on serverless.
3. **Verify at /setup** — Open `https://your-app.vercel.app/setup` to confirm all systems are green.

For a manual deploy path (local Docker, custom domain), see [Deploy without OAuth](docs/deploy-without-oauth.md).
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Neon deploy button: `integration-ids=oac_*` | `products=[{integrationSlug:"neon",...}]` slug format | 2024-2025 (Vercel Marketplace refresh) | Integration ID `oac_VqOgBHqhEoFTPzGkPd7L0iH6` is unverified; use slug format |
| Vercel env defaults: none | `envDefaults` parameter added | 2024 | Non-sensitive config can be pre-populated; never use for secrets |
| Manual cron registration | `crons` array in `vercel.json` | Stable since 2022 | Confirmed format unchanged |
| `db:push` unsafe on existing schema | `db:push` safe without `--force` flag | Drizzle Kit 0.20+ | Confirmed: `buildCommand` approach is safe for additive schema changes |

**Deprecated/outdated:**
- `integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6`: LOW confidence ID; the Neon marketplace integration format has shifted to `products=` slug JSON.

---

## Open Questions

1. **`db:push` interactive prompt on schema drift**
   - What we know: `db:push` without `--force` does not drop data; destructive operations require confirmation.
   - What's unclear: Whether Drizzle prompts interactively during a Vercel build (non-TTY environment) and whether this hangs or auto-accepts.
   - Recommendation: Test `npm run db:push` against a live Neon DB in a CI/non-interactive context before first public deploy. If it hangs, add `--force` flag or switch to `drizzle-kit migrate` (file-based migration).

2. **`products=` parameter support scope**
   - What we know: Official Neon template uses `products=` slug JSON as of 2025.
   - What's unclear: Whether this parameter is available on all Vercel plans or only specific tiers. The parameter does not appear in Vercel's official deploy button docs yet.
   - Recommendation: Build the URL with `products=` + `skippable-integrations=1`. Test the deploy button URL manually before publishing to README. If `products=` is ignored, DATABASE_URL still appears as a manual field.

3. **CRON_SECRET severity: advisory vs required**
   - What we know: CRON_SECRET absence causes silent cron failures (no signals, no integration health). This is a serious production concern.
   - What's unclear: Whether to make CRON_SECRET a blocking REQUIRED_ENV_VAR (adds to `overall: blocked` state) or advisory ADVISORY_ENV_VAR (adds to `overall: needs_attention`).
   - Recommendation: Make it ADVISORY (warn severity). The deploy button includes it as a prompted `env=` field, so it will almost always be set on new deployments. Making it REQUIRED would block existing deployments where crons aren't used.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | `vitest.config.js` (root) |
| Quick run command | `npx vitest run __tests__/unit/readiness.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | Deploy button URL contains exactly 7 env var keys | unit (string test) | `npx vitest run __tests__/unit/deploy-button.test.js` | Wave 0 |
| DEPLOY-02 | `vercel.json` contains framework, buildCommand, cron paths | manual / JSON parse | Manual JSON review (no test needed — pure config) | N/A |
| DEPLOY-03 | README contains deploy button badge and 3-step checklist | manual | Manual review | N/A |
| DEPLOY-04a | NEXTAUTH_URL mismatch: returns warn when URL host differs from request host | unit | `npx vitest run __tests__/unit/readiness.test.js` | Extend existing |
| DEPLOY-04b | NEXTAUTH_URL mismatch: returns pass when hosts match | unit | `npx vitest run __tests__/unit/readiness.test.js` | Extend existing |
| DEPLOY-04c | Realtime check: returns warn when VERCEL=1 and no REDIS_URL | unit | `npx vitest run __tests__/unit/readiness.test.js` | Extend existing |
| DEPLOY-04d | Realtime check: returns pass when UPSTASH_REDIS_REST_URL is present | unit | `npx vitest run __tests__/unit/readiness.test.js` | Extend existing |
| DEPLOY-04e | CRON_SECRET absence: surfaces as advisory warn check | unit | `npx vitest run __tests__/unit/readiness.test.js` | Extend existing |
| DEPLOY-04f | Schema status: existing `no_tables` case already returns fail | unit | `npx vitest run __tests__/unit/readiness.test.js` | Exists (passing) |

### Sampling Rate

- **Per task commit:** `npx vitest run __tests__/unit/readiness.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/unit/deploy-button.test.js` — covers DEPLOY-01 URL parameter validation (optional: can be manual review if URL is hand-constructed)
- [ ] Extend `__tests__/unit/readiness.test.js` with DEPLOY-04a through DEPLOY-04e test cases

*(DEPLOY-04f and DEPLOY-02/03 are already covered or manual-only)*

---

## Sources

### Primary (HIGH confidence)

- [Vercel deploy button env variables docs](https://vercel.com/docs/integrations/deploy-button/environment-variables) — `env`, `envDescription`, `envLink`, `envDefaults` parameters confirmed
- [Vercel deploy button integrations docs](https://vercel.com/docs/integrations/deploy-button/integrations) — `integration-ids`, `skippable-integrations` format confirmed
- [Vercel project configuration docs](https://vercel.com/docs/project-configuration/vercel-json) — `crons`, `framework`, `buildCommand` format confirmed
- `app/lib/readiness.mjs` — Direct codebase inspection of `getReadinessReport()` shape
- `app/lib/readiness/constants.mjs` — Confirmed current REQUIRED_ENV_VARS and ADVISORY_ENV_VARS
- `app/lib/schemaCheck.js` — `checkCoreTables()` uses `information_schema.tables`
- `app/lib/events.js` — Lines 23-26 confirm memory backend fallback behavior
- `vercel.json` — Confirmed currently `{}`
- `.env.example` — Confirmed 122 lines, 7 env vars needed for deploy button
- [drizzle-kit push docs](https://orm.drizzle.team/docs/drizzle-kit-push) — Confirmed safe without `--force`

### Secondary (MEDIUM confidence)

- [neondatabase/vercel-marketplace-neon](https://github.com/neondatabase/vercel-marketplace-neon) — Current `products=` slug format confirmed from official Neon repo deploy button URL

### Tertiary (LOW confidence)

- Community-sourced Neon integration ID `oac_3sK3gnG06emjIEVL09jjntDD` — Single Vercel community forum reference, unverified against live marketplace
- `oac_VqOgBHqhEoFTPzGkPd7L0iH6` from prior research — Unverified, superceded by `products=` slug approach

---

## Metadata

**Confidence breakdown:**
- vercel.json configuration: HIGH — confirmed from official docs
- Deploy button URL format: HIGH (core params) / MEDIUM (Neon products= slug)
- db:push idempotency: MEDIUM — behavior confirmed safe without `--force`; non-TTY edge case unverified
- Health check extension pattern: HIGH — direct codebase inspection
- Test infrastructure: HIGH — Vitest config and existing readiness.test.js confirmed

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (Vercel deploy button format is stable; Neon integration parameter format LOW risk of change in 30 days)
