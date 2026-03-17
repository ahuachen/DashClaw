---
phase: 01-deploy-funnel
plan: "01"
subsystem: infra
tags: [vercel, nextjs, neon, drizzle, deploy-button, cron]

# Dependency graph
requires: []
provides:
  - vercel.json with framework preset and two cron routes (signals every 5m, integration-health every 6h)
  - README deploy button with 7-env-var URL and Neon integration offer
  - Post-deploy 3-step checklist (NEXTAUTH_URL, Redis, /setup verification)
affects: [02-02, 02-03, 03-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vercel deploy button URL pattern: vercel.com/new/clone with env, products (Neon slug), and skippable-integrations=1"
    - "Drizzle db:push kept out of buildCommand — manual migration step required after first deploy"

key-files:
  created: []
  modified:
    - vercel.json
    - README.md

key-decisions:
  - "db:push removed from buildCommand — Drizzle push hangs in non-TTY (Vercel build) environment when schema changes exist; moved to manual post-deploy step in README"
  - "skippable-integrations=1 allows deploy without Neon (DATABASE_URL field still appears for manual entry)"
  - "NEXTAUTH_URL has no envDefault — must be set consciously by developer after deploy URL is known"
  - "Both cron routes (/api/cron/signals, /api/cron/integration-health) registered in vercel.json — routes already existed in codebase"

patterns-established:
  - "Pattern 1: Vercel deploy button — encode env, products (Neon), envDescription, envLink, project-name, repository-name, skippable-integrations in URL"
  - "Pattern 2: Post-deploy checklist order — NEXTAUTH_URL first (blocking), Redis second (optional), /setup third (verify)"

requirements-completed: [DEPLOY-01, DEPLOY-02, DEPLOY-03]

# Metrics
duration: ~10min (execution) + checkpoints
completed: 2026-03-17
---

# Phase 1 Plan 01: Vercel Deploy Infrastructure Summary

**One-click Vercel deploy button in README with 7-env-var URL, Neon integration offer, and manual db:push step after non-TTY verification failed**

## Performance

- **Duration:** ~10 min execution + 2 human-verify checkpoints
- **Started:** 2026-03-17T19:24:30-0400
- **Completed:** 2026-03-17T19:33:11-0400
- **Tasks:** 4 (2 auto + 2 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- vercel.json configured with Next.js framework preset and two cron routes (signals every 5 minutes, integration-health every 6 hours)
- README deploy button added above the fold with 7 env vars and Neon integration (`skippable-integrations=1` allows bypass)
- Post-deploy 3-step checklist covers NEXTAUTH_URL update, optional Redis, and /setup verification
- Verified live: Vercel deploy page shows all 7 env var fields and Neon integration Add button with envDescription and Learn More link

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure vercel.json with framework preset, cron routes, and buildCommand** - `a10f1ab` (chore)
2. **Task 2: Add Vercel deploy button and post-deploy instructions to README** - `2bac114` (feat)
3. **Task 3: Verify db:push idempotency in non-TTY environment** - `fab09ac` (fix — checkpoint resolved with fallback applied)
4. **Task 4: Verify deploy button URL opens Vercel with correct configuration** - N/A (human-verified, no code change required)

## Files Created/Modified

- `vercel.json` — Framework preset (nextjs), buildCommand (next build only), two cron routes registered
- `README.md` — Deploy button badge above the fold, 7-env-var URL with Neon integration, 3-step post-deploy checklist, manual migration step added

## Decisions Made

- **db:push excluded from buildCommand:** Task 3 checkpoint revealed that `npm run db:push` hangs in non-TTY environments when schema changes require confirmation. Removed from buildCommand; added as manual step 4 in README post-deploy checklist under a "Database Setup" note.
- **skippable-integrations=1 kept:** Task 4 confirmed this works as intended — Neon panel shows with Add button but is skippable, and DATABASE_URL field still appears for manual entry.
- **NEXTAUTH_URL without default:** Confirmed correct per locked decision — post-deploy step 1 prompts the developer to set it after the deployment URL is known.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed db:push from buildCommand after non-TTY hang confirmed**

- **Found during:** Task 3 (Verify db:push idempotency in non-TTY environment — checkpoint:human-verify)
- **Issue:** `npm run db:push` hangs waiting for interactive input in Vercel's non-TTY build environment when schema changes require confirmation. The plan's original buildCommand `"npm run db:push && next build"` would cause build timeouts on schema-changed deployments.
- **Fix:** Changed buildCommand to `"next build"` only. Added manual db:push instruction as a README post-deploy step.
- **Files modified:** `vercel.json`, `README.md`
- **Verification:** Human confirmed the non-TTY hang. Fallback applied per CONTEXT.md fallback option.
- **Committed in:** `fab09ac` (fix(01-01): remove db:push from buildCommand)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan assumption)
**Impact on plan:** Essential fix — original buildCommand would cause Vercel build timeouts. The fallback (manual step in README) is the correct pattern for schema migrations. No scope creep.

## Issues Encountered

- Task 3 originally expected `db:push` to be safe in non-TTY (MEDIUM confidence in research). Verification revealed it hangs without TTY when schema changes exist. Fallback from CONTEXT.md was applied: buildCommand stripped to `next build`, manual migration step added to README.
- Task 4 passed cleanly — all 7 env vars visible, Neon integration panel present, envDescription and Learn More link working.

## User Setup Required

After deploying via the button:

1. Set `NEXTAUTH_URL` in Vercel Project Settings to the deployment URL, then redeploy
2. Run `npm run db:push` locally targeting the Neon DATABASE_URL (or use Neon SQL editor) to apply schema
3. Optionally add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for live stream
4. Verify at `/setup`

## Next Phase Readiness

- Deploy infrastructure is complete and human-verified against live Vercel Marketplace
- Phase 1 Plan 02 (deploy readiness check) already complete — /setup page signals config gaps at runtime
- Phase 1 Plan 03 can build on verified deploy URL pattern for connect flow

---
*Phase: 01-deploy-funnel*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: .planning/phases/01-deploy-funnel/01-01-SUMMARY.md
- FOUND: a10f1ab (chore(01-01): configure vercel.json)
- FOUND: 2bac114 (feat(01-01): add deploy button to README)
- FOUND: fab09ac (fix(01-01): remove db:push from buildCommand)
