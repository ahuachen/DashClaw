# Phase 1: Deploy Funnel - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the deploy path so a developer goes from the DashClaw GitHub README to a fully functional self-hosted instance in under 10 minutes. This phase covers: `vercel.json` configuration, one-click Vercel deploy button, post-deploy setup instructions, and enhanced `/setup` health checks. No new governance routes. No new product features.

</domain>

<decisions>
## Implementation Decisions

### NEXTAUTH_URL handling
- Manual post-deploy step — user updates NEXTAUTH_URL to their deployment URL after first deploy
- `/setup` page detects mismatch between NEXTAUTH_URL and current host and surfaces a prominent warning with fix instructions
- Do NOT use `$VERCEL_URL` substitution — it only works for preview deployments, not production custom domains
- Post-deploy instructions in README make this the first thing users see after deploy completes
- This is the standard approach (Supabase, Vercel's own templates follow this pattern)

### Redis requirement framing
- Redis is OPTIONAL at deploy time, not a blocker — deploy works in in-memory mode
- `/setup` surfaces a clear "Upgrade to live stream" recommendation when Redis backend is absent on Vercel (detected via VERCEL env var)
- This lets people deploy and see the dashboard immediately, then add Upstash Redis for Mission Control live stream
- In-memory fallback is acceptable for evaluation/testing; production guidance recommends Redis

### Deploy button scope
- Include Neon Marketplace `integration-ids` parameter in the deploy button URL — auto-provisions the database in one click
- Exact integration ID must be verified against the live Vercel Marketplace before shipping (research flagged `oac_VqOgBHqhEoFTPzGkPd7L0iH6` but LOW confidence)
- If integration-ids works: user clicks deploy → Neon DB provisioned + env vars auto-filled → no manual DB setup
- Fallback: if integration-ids is wrong, DATABASE_URL remains a required env var with instructions linking to Neon free tier
- Deploy button URL encodes exactly 6 required env vars: DATABASE_URL, DASHCLAW_API_KEY, ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET
- DASHCLAW_LOCAL_ADMIN_PASSWORD included as 7th for passwordless-OAuth path (simplest auth for new deployers)

### vercel.json configuration
- Add `framework: "nextjs"` preset
- Register cron routes: `/api/cron/signals` (every 5 min), `/api/cron/integration-health` (every 6 hours)
- Set `buildCommand: "npm run db:push && next build"` to automate schema migration on every deploy
- Verify that `npm run db:push` (Drizzle push) is idempotent on existing schemas before shipping — if destructive on drift, use startup-time check instead

### Health check enhancements
- Extend existing `getReadinessReport()` in `app/lib/readiness.mjs` — no new page, no new API route
- New checks to add:
  1. NEXTAUTH_URL vs current host mismatch detection
  2. Realtime backend type (warn if in-memory on Vercel/serverless)
  3. CRON_SECRET presence check
  4. Schema migration status (tables exist)
- Surface warnings prominently in the existing `/setup` TopSummary component
- Each warning includes a one-line fix instruction (e.g., "Set NEXTAUTH_URL to https://your-app.vercel.app in Vercel → Settings → Environment Variables")

### README deploy section
- Deploy button badge appears above the fold (before any other content)
- Immediately below: 3-step post-deploy checklist (NEXTAUTH_URL, Upstash Redis optional, verify at /setup)
- Link to `docs/deploy-without-oauth.md` for detailed manual path
- `$0 deploy` callout — Vercel free tier + Neon free tier = zero cost

### Claude's Discretion
- Exact deploy button URL query parameter formatting
- README section layout and badge styling
- Health check warning copy and severity levels
- Whether to add deploy button to `/self-host` page in addition to README

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deploy configuration
- `vercel.json` — Currently empty `{}`; must be updated with framework preset, crons, and buildCommand
- `docs/deploy-without-oauth.md` — Existing manual deploy guide (9-step process); deploy button replaces steps 1-4
- `.env.example` — Full env var surface (122 lines); deploy button uses only 6-7 required vars

### Existing readiness system
- `app/lib/readiness.mjs` — `getReadinessReport()` function; new health checks extend this
- `app/setup/page.js` — Setup page entry point; uses readiness report to render TopSummary, VerificationSection
- `app/setup/components/TopSummary.js` — Where readiness warnings surface to users
- `app/api/health/route.js` — Health endpoint; already checks DB tables via `checkCoreTables()` and realtime via `getRealtimeHealth()`
- `app/lib/schemaCheck.js` — `checkCoreTables()` function used by health endpoint
- `app/lib/events.js` — Contains realtime backend detection; `getRealtimeHealth()` already distinguishes memory vs Redis

### Research findings
- `.planning/research/PITFALLS.md` — NEXTAUTH_URL chicken-and-egg, Redis fallback, env var overload, db:push idempotency
- `.planning/research/STACK.md` — Deploy button URL format, vercel.json schema, Neon integration-ids
- `.planning/research/ARCHITECTURE.md` — Confirms all adoption work is additive at edges; no runtime changes

### Codebase concerns
- `.planning/codebase/CONCERNS.md` — Documents Redis silent fallback as known bug (lines 54-58)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getReadinessReport()` in `app/lib/readiness.mjs` — Existing readiness check framework; new checks plug in here
- `checkCoreTables()` in `app/lib/schemaCheck.js` — Already validates schema presence; reuse for migration check
- `getRealtimeHealth()` in `app/lib/events.js` — Already returns backend type (memory vs redis) and status
- `TopSummary` component in `app/setup/components/TopSummary.js` — Where warnings render
- `ConnectNextStepPanel` in `app/setup/components/ConnectNextStepPanel.js` — Existing post-deploy guidance pattern

### Established Patterns
- Route handlers use `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`
- `/setup` page is a server component using `headers()` for host detection
- Health checks follow the `{ status, checks: { [name]: { status, ...details } } }` shape
- Readiness report already checks: database connectivity, authentication config, API key, SDK version

### Integration Points
- `vercel.json` — Root config file, read by Vercel build system
- `README.md` — Deploy button badge goes here (above the fold)
- `app/lib/readiness.mjs` — New checks added to existing report function
- `app/setup/components/TopSummary.js` — New warnings rendered here

</code_context>

<specifics>
## Specific Ideas

- User wants a literal "1 button" experience — current flow requires fork → Vercel import → Neon DB → env vars → deploy → migrate. Target: click → deploy → verify at /setup.
- User specifically mentioned the current flow: "fork, start on vercel, create neon database, run migrations, create redis" — each of these steps is friction to eliminate or automate.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-deploy-funnel*
*Context gathered: 2026-03-17*
