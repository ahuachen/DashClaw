# Handoff: Local Postgres Speed Work (2026-02-14)

## Why This Exists

We hit a blocker trying to use a local Postgres database (Docker on `localhost:5432`) instead of Neon:

- DashClaw currently uses `@neondatabase/serverless` (`neon(...)`) in many places.
- The Neon serverless driver uses `fetch`-based connectivity and **cannot talk to a normal TCP Postgres server on `localhost`**.
- Result: migrations/scripts fail with `TypeError: fetch failed` when `DATABASE_URL` points to `postgresql://...@localhost:5432/...`.

Goal: support both:

- Neon URLs (keep using `@neondatabase/serverless`)
- Local/self-host Postgres URLs (use a TCP driver) so local DB is fast and works offline

## Progress Checklist (Update As We Go)

- [x] Add dual DB adapter for app runtime (`app/lib/db.js`) (Neon vs TCP)
- [x] Update NextAuth DB usage to use shared adapter (`app/lib/auth.js`)
- [x] Add dual DB adapter for scripts (`scripts/_db.mjs`)
- [x] Update core migrations to use script adapter:
  - [x] `scripts/migrate-multi-tenant.mjs`
  - [x] `scripts/migrate-cost-analytics.mjs`
  - [x] `scripts/migrate-identity-binding.mjs`
  - [x] `scripts/migrate-learning-loop-mvp.mjs`
  - [x] `scripts/migrate-behavioral-ai.mjs`
  - [x] `scripts/migrate-action-records-compat.mjs`
- [x] Update script utilities to use script adapter:
  - [x] `scripts/create-org.mjs`
  - [x] `scripts/register-identity.mjs`
  - [x] `scripts/cleanup-actions.mjs`
  - [x] `scripts/cleanup-org-default.mjs`
  - [x] `scripts/backfill-learning-episodes.mjs`
  - [x] `scripts/rebuild-learning-recommendations.mjs`
  - [x] `scripts/backfill-embeddings.mjs`
- [x] Add TCP Postgres dependency: `postgres` (in `package.json` / `package-lock.json`)
- [x] Convert remaining API routes off direct `neon(...)` to `getSql()`:
  - [x] `app/api/digest/route.js`
  - [x] `app/api/goals/route.js`
  - [x] `app/api/content/route.js`
  - [x] `app/api/calendar/route.js`
  - [x] `app/api/bounties/route.js`
  - [x] `app/api/agents/connections/route.js`
  - [x] `app/api/actions/signals/route.js`
  - [x] `app/api/actions/route.js` (core actions API)
  - [x] `app/api/actions/[actionId]/route.js`
  - [x] `app/api/actions/[actionId]/trace/route.js`
  - [x] `app/api/actions/assumptions/route.js`
  - [x] `app/api/actions/assumptions/[assumptionId]/route.js`
  - [x] `app/api/actions/loops/route.js`
  - [x] `app/api/actions/loops/[loopId]/route.js`
  - [x] `app/api/inspiration/route.js`
  - [x] `app/api/relationships/route.js`
  - [x] `app/api/context/points/route.js`
  - [x] `app/api/context/threads/[threadId]/route.js`
  - [x] `app/api/context/threads/[threadId]/entries/route.js`
  - [x] `app/api/workflows/route.js`
  - [x] `app/api/schedules/route.js`
  - [x] `app/api/learning/route.js`
  - [x] `app/api/learning/recommendations/route.js`
  - [x] `app/api/learning/recommendations/events/route.js`
  - [x] `app/api/learning/recommendations/metrics/route.js`
  - [x] `app/api/learning/recommendations/[recommendationId]/route.js`
  - [x] `app/api/tokens/route.js`
  - [x] `app/api/memory/route.js`
  - [x] `app/api/preferences/route.js`
  - [x] `app/api/snippets/route.js`
  - [x] `app/api/snippets/[snippetId]/use/route.js`
  - [x] `app/api/security/status/route.js` (also now returns stable `{ checks: [] }` on errors/403 to avoid UI crash)
  - [x] `app/api/onboarding/api-key/route.js`
  - [x] `app/api/orgs/[orgId]/route.js`
  - [x] `app/api/orgs/[orgId]/keys/route.js`
  - [ ] `app/api/settings/test/route.js` (intentionally Neon-only; keep SSRF allowlist strict)
  - [x] Follow-up: converted remaining `require('@neondatabase/serverless')` usage in:
    - `app/api/sync/route.js`
    - `app/api/keys/route.js`
    - `app/api/guard/route.js`
    - `app/api/invite/[token]/route.js`
    - `app/api/notifications/route.js`
    - `app/api/policies/route.js`
    - `app/api/team/invite/route.js`
    - `app/api/team/[userId]/route.js`
    - `app/api/webhooks/[webhookId]/test/route.js`
    - `app/api/webhooks/[webhookId]/deliveries/route.js`
    - `app/api/cron/signals/route.js`
- [ ] Validate local DB end-to-end (Docker Postgres + migrations + `npm run dev`)
- [x] Run CI parity checks locally (`npm run lint`, `npm run build`, `npm run route-sql:check`)
- [x] Commit + push

## Current Status (Where We Are)

Work is in-progress. A dual-driver adapter is implemented for core library + scripts, and a few API routes were switched over.

Uncommitted changes are present in these files (run `git status --porcelain` to verify):

- `app/lib/db.js`
- `app/lib/auth.js`
- `app/api/digest/route.js`
- `app/api/goals/route.js`
- `app/api/content/route.js`
- `app/api/calendar/route.js`
- `app/api/bounties/route.js`
- `app/api/agents/connections/route.js`
- `app/api/actions/signals/route.js`
- `scripts/_db.mjs` (new)
- `scripts/migrate-multi-tenant.mjs`
- `scripts/migrate-cost-analytics.mjs`
- `scripts/migrate-identity-binding.mjs`
- `scripts/migrate-learning-loop-mvp.mjs`
- `scripts/migrate-behavioral-ai.mjs`
- `scripts/migrate-action-records-compat.mjs`
- `scripts/create-org.mjs`
- `scripts/register-identity.mjs`
- `scripts/cleanup-actions.mjs`
- `scripts/cleanup-org-default.mjs`
- `scripts/backfill-learning-episodes.mjs`
- `scripts/rebuild-learning-recommendations.mjs`
- `scripts/backfill-embeddings.mjs`
- `package.json`
- `package-lock.json`

Important: many other API routes still import and use `neon(...)` directly, including the main actions API (`app/api/actions/route.js`). Until those are migrated to the adapter, the app will still break when pointed at local Postgres.

## What Was Done

### 1) Added a Dual DB Adapter (Neon vs TCP)

File: `app/lib/db.js`

- Added support for:
  - Neon URLs: use `@neondatabase/serverless` (`neon(url)`)
  - Non-Neon URLs (ex: localhost): use `postgres` (direct TCP)
- Exposed the same API shape the app expects:
  - tagged-template function `sql\`...\``
  - `sql.query(text, params)` for `$1` style parameterized SQL
- Added optional env overrides:
  - `DASHCLAW_DB_DRIVER=neon|postgres` (force driver)
  - `DASHCLAW_DB_POOL_MAX=<int>` (pool size for TCP driver; default 10)

### 2) Updated NextAuth DB Usage To Use Shared Adapter

File: `app/lib/auth.js`

- Removed its private Neon-only `getSql()` and switched to `import { getSql } from './db.js'`.

### 3) Added Script-Side Dual DB Adapter

File: `scripts/_db.mjs` (new)

- Implements the same Neon-vs-TCP decision logic for scripts (migrations/backfills).

### 4) Updated Key Scripts/Migrations To Use `scripts/_db.mjs`

These scripts now call `createSqlFromEnv()` instead of `neon(DATABASE_URL)`:

- `scripts/migrate-multi-tenant.mjs`
- `scripts/migrate-cost-analytics.mjs`
- `scripts/migrate-identity-binding.mjs`
- `scripts/migrate-learning-loop-mvp.mjs`
- `scripts/migrate-behavioral-ai.mjs`
- `scripts/migrate-action-records-compat.mjs`
- `scripts/create-org.mjs`
- `scripts/register-identity.mjs`
- `scripts/cleanup-actions.mjs`
- `scripts/cleanup-org-default.mjs`
- `scripts/backfill-learning-episodes.mjs`
- `scripts/rebuild-learning-recommendations.mjs`
- `scripts/backfill-embeddings.mjs`

### 5) Switched A Few API Routes To Use `app/lib/db.js`

These routes were changed from `neon(process.env.DATABASE_URL)` to `getSql()`:

- `app/api/digest/route.js`
- `app/api/goals/route.js`
- `app/api/content/route.js`
- `app/api/calendar/route.js`
- `app/api/bounties/route.js`

Also removed Neon-only `getSql()` wrappers in:

- `app/api/agents/connections/route.js`
- `app/api/actions/signals/route.js`

### 6) Added NPM Dependency For TCP Postgres

- Installed: `postgres` (now in `package.json` and `package-lock.json`)

## What Still Needs To Be Done (Next Steps)

### A) Convert Remaining API Routes Off Direct `neon(...)`

Many API routes still import `@neondatabase/serverless` and call `neon(url)` directly. For local Postgres support they must use `getSql()` from `app/lib/db.js` (or an equivalent adapter) instead.

High priority (blocks dashboard usability):

- `app/api/actions/route.js` (core dashboard data)
- `app/api/actions/[actionId]/route.js`
- `app/api/actions/[actionId]/trace/route.js`
- `app/api/actions/assumptions/*`
- `app/api/actions/loops/*`

Then broaden to the rest (tokens, learning, orgs/keys/team, webhooks, etc.).

### B) Keep CI Guardrails Passing

After refactors:

- `npm run route-sql:check` must pass (do not increase route-level direct SQL usage).
- `npm run lint`
- `npm run build`

### C) Validate Local DB End-to-End

Once routes/scripts use the adapter:

1) Start local DB:
```powershell
docker compose up -d db
```

2) Set `.env.local`:
```env
DATABASE_URL=postgresql://dashclaw:dashclaw@localhost:5432/dashclaw
```

3) Run migrations:
```powershell
node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
```

4) Run app:
```powershell
npm run dev
```

If speed is still poor, compare to production mode:
```powershell
npm run build
npm run start
```

### D) Commit + Push

After routes are migrated and checks pass:

- commit the local-postgres adapter work
- push to `main`

## Rationale (Why This Approach)

- Smallest change with the highest impact: keep the existing SQL usage pattern (tagged templates + `.query`) but swap the underlying driver depending on URL.
- Avoids forcing all self-hosters to Neon.
- Keeps Neon working unchanged (still preferred for hosted/self-host cloud setups).
